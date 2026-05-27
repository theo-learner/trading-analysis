'use strict';

const crypto = require('node:crypto');
const { BaseExchange } = require('./base');

const DEFAULT_BASE_URL = 'https://fapi.binance.com';
const RECV_WINDOW      = 5000;
const RETRY_DELAYS     = [250, 750, 2000];

class BinanceExchange extends BaseExchange {
  constructor(creds) {
    super({
      apiKey:    creds.apiKey,
      apiSecret: creds.apiSecret,
      baseUrl:   creds.baseUrl ?? DEFAULT_BASE_URL,
    });
    this._symbolInfoCache = {};  // symbol → { stepSize, tickSize, minNotional }
    this._serverTimeDrift = 0;   // ms diff: serverTime - localTime
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  _sign(paramString) {
    return crypto.createHmac('sha256', this.apiSecret).update(paramString).digest('hex');
  }

  _buildQuery(params) {
    return Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join('&');
  }

  async _request(method, endpoint, params = {}, signed = false) {
    const timestamp = Date.now() + this._serverTimeDrift;
    let qs = this._buildQuery(params);

    if (signed) {
      const signedParams = { ...params, timestamp, recvWindow: RECV_WINDOW };
      qs = this._buildQuery(signedParams);
      const sig = this._sign(qs);
      qs += `&signature=${sig}`;
    }

    const url = method === 'GET'
      ? `${this.baseUrl}${endpoint}${qs ? '?' + qs : ''}`
      : `${this.baseUrl}${endpoint}`;

    const fetchOpts = {
      method,
      headers: { 'X-MBX-APIKEY': this.apiKey, 'Content-Type': 'application/x-www-form-urlencoded' },
      signal: AbortSignal.timeout(15000),
    };
    if (method !== 'GET') fetchOpts.body = qs;

    let lastErr;
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const res  = await fetch(url, fetchOpts);
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON response: ${text.slice(0, 200)}`); }

        if (!res.ok) {
          const code = json?.code;
          // -1021: timestamp out of sync → resync and retry once
          if (code === -1021 && attempt === 0) {
            const srvTime = await this._syncTime();
            this._serverTimeDrift = srvTime - Date.now();
            attempt--;  // retry immediately
            continue;
          }
          // 4xx client errors — never retry
          if (res.status >= 400 && res.status < 500) {
            const e = new Error(`Binance API error ${code}: ${json?.msg ?? text}`);
            e.code = code;
            e.status = res.status;
            throw e;
          }
          throw new Error(`Binance HTTP ${res.status}: ${json?.msg ?? text}`);
        }
        return json;
      } catch (err) {
        lastErr = err;
        // Don't retry 4xx
        if (err.status >= 400 && err.status < 500) throw err;
        if (attempt < RETRY_DELAYS.length) {
          await _sleep(RETRY_DELAYS[attempt]);
        }
      }
    }
    throw lastErr;
  }

  async _syncTime() {
    const data = await this._request('GET', '/fapi/v1/time', {}, false);
    return data.serverTime;
  }

  // ── Public interface ─────────────────────────────────────────────────────

  async getServerTime() {
    return this._syncTime();
  }

  async getAccountBalance() {
    const data = await this._request('GET', '/fapi/v2/balance', {}, true);
    const usdt = data.find(b => b.asset === 'USDT');
    return usdt ? parseFloat(usdt.availableBalance) : 0;
  }

  async getSymbolInfo(symbol) {
    if (this._symbolInfoCache[symbol]) return this._symbolInfoCache[symbol];
    const data = await this._request('GET', '/fapi/v1/exchangeInfo', {}, false);
    for (const s of data.symbols || []) {
      const filters = {};
      for (const f of s.filters || []) {
        if (f.filterType === 'LOT_SIZE')      filters.stepSize    = parseFloat(f.stepSize);
        if (f.filterType === 'PRICE_FILTER')  filters.tickSize    = parseFloat(f.tickSize);
        if (f.filterType === 'MIN_NOTIONAL')  filters.minNotional = parseFloat(f.minNotional ?? f.notional ?? 5);
        // Binance Futures uses NOTIONAL filter (not MIN_NOTIONAL) for the $20 minimum order value
        if (f.filterType === 'NOTIONAL')      filters.minNotional = Math.max(filters.minNotional ?? 0, parseFloat(f.minNotional ?? 20));
      }
      this._symbolInfoCache[s.symbol] = { stepSize: filters.stepSize ?? 0.001, tickSize: filters.tickSize ?? 0.1, minNotional: filters.minNotional ?? 5 };
    }
    return this._symbolInfoCache[symbol] ?? { stepSize: 0.001, tickSize: 0.1, minNotional: 5 };
  }

  async setLeverage(symbol, leverage) {
    await this._request('POST', '/fapi/v1/leverage', { symbol, leverage }, true);
  }

  async setMarginType(symbol, marginType) {
    try {
      await this._request('POST', '/fapi/v1/marginType', { symbol, marginType: marginType.toUpperCase() }, true);
    } catch (err) {
      // -4046: No need to change margin type (already set) — treat as success
      if (err.code === -4046) return;
      throw err;
    }
  }

  async getMarkPrice(symbol) {
    const data = await this._request('GET', '/fapi/v1/premiumIndex', { symbol }, false);
    return parseFloat(data.markPrice);
  }

  async placeMarketOrder(symbol, side, qty) {
    const data = await this._request('POST', '/fapi/v1/order', {
      symbol,
      side,
      type: 'MARKET',
      quantity: qty,
    }, true);
    const fills = data.fills ?? [];
    let filledPrice = fills.length
      ? fills.reduce((s, f) => s + parseFloat(f.price) * parseFloat(f.qty), 0) / fills.reduce((s, f) => s + parseFloat(f.qty), 0)
      : parseFloat(data.avgPrice ?? data.price ?? 0);
    // Binance Futures MARKET sometimes returns avgPrice="0.00000" — fall back to mark price
    if (!filledPrice) {
      filledPrice = await this.getMarkPrice(symbol);
    }
    return {
      orderId:     data.orderId,
      filledPrice,
      filledQty:   parseFloat(data.executedQty ?? qty),
    };
  }

  async placeStopMarket(symbol, side, stopPrice, qty) {
    const data = await this._request('POST', '/fapi/v1/order', {
      symbol,
      side,
      type:        'STOP_MARKET',
      stopPrice,
      quantity:    qty,
      reduceOnly:  'true',
      workingType: 'MARK_PRICE',
    }, true);
    return { orderId: data.orderId };
  }

  async placeTakeProfitMarket(symbol, side, stopPrice, qty) {
    const data = await this._request('POST', '/fapi/v1/order', {
      symbol,
      side,
      type:        'TAKE_PROFIT_MARKET',
      stopPrice,
      quantity:    qty,
      reduceOnly:  'true',
      workingType: 'MARK_PRICE',
    }, true);
    return { orderId: data.orderId };
  }

  async placeTakeProfitOrder(symbol, side, triggerPrice, qty) {
    // Binance TAKE_PROFIT_MARKET already returns a real orderId — reuse directly
    return this.placeTakeProfitMarket(symbol, side, triggerPrice, qty);
  }

  async getPosition(symbol) {
    const data = await this._request('GET', '/fapi/v2/positionRisk', { symbol }, true);
    const pos = Array.isArray(data) ? data.find(p => p.symbol === symbol) : data;
    if (!pos) return { size: 0, entryPrice: 0, side: null };
    const size = parseFloat(pos.positionAmt ?? 0);
    return {
      size:       Math.abs(size),
      entryPrice: parseFloat(pos.entryPrice ?? 0),
      side:       size > 0 ? 'LONG' : size < 0 ? 'SHORT' : null,
    };
  }

  async getOpenOrders(symbol) {
    const data = await this._request('GET', '/fapi/v1/openOrders', { symbol }, true);
    return (data || []).map(o => ({
      orderId:   o.orderId,
      type:      o.type,
      side:      o.side,
      stopPrice: parseFloat(o.stopPrice ?? 0),
      origQty:   parseFloat(o.origQty ?? 0),
      status:    o.status,
    }));
  }

  async cancelOrder(symbol, orderId) {
    await this._request('DELETE', '/fapi/v1/order', { symbol, orderId }, true);
  }

  async closePosition(symbol, positionSide) {
    const closeSide = positionSide === 'LONG' ? 'SELL' : 'BUY';
    const pos = await this.getPosition(symbol);
    if (!pos.size) return;
    await this._request('POST', '/fapi/v1/order', {
      symbol,
      side:        closeSide,
      type:        'MARKET',
      quantity:    pos.size,
      reduceOnly:  'true',
    }, true);
  }
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { BinanceExchange };
