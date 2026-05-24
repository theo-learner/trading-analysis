'use strict';

const crypto = require('node:crypto');
const { BaseExchange } = require('./base');

const DEFAULT_BASE_URL = 'https://api.bybit.com';
const RECV_WINDOW      = 5000;
const RETRY_DELAYS     = [250, 750, 2000];
const FILL_POLL_MS     = 1500;  // wait before querying fill price after MARKET order

class BybitExchange extends BaseExchange {
  constructor(creds) {
    super({
      apiKey:    creds.apiKey,
      apiSecret: creds.apiSecret,
      baseUrl:   creds.baseUrl ?? DEFAULT_BASE_URL,
    });
    this._symbolInfoCache = {};
    this._serverTimeDrift = 0;
  }

  // ── Helpers ──────────────────────────────────────────────────────────────

  _sign(timestamp, payload) {
    const msg = `${timestamp}${this.apiKey}${RECV_WINDOW}${payload}`;
    return crypto.createHmac('sha256', this.apiSecret).update(msg).digest('hex');
  }

  async _syncTime() {
    try {
      const res  = await fetch(`${this.baseUrl}/v5/market/time`, { signal: AbortSignal.timeout(5000) });
      const json = await res.json();
      const sec  = parseInt(json.result?.timeSecond ?? 0, 10);
      return sec > 0 ? sec * 1000 : Date.now();
    } catch {
      return Date.now();
    }
  }

  async _request(method, endpoint, params = {}, signed = false) {
    let lastErr;
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      const timestamp = Date.now() + this._serverTimeDrift;

      let url, body, sign;
      if (method === 'GET') {
        const qs = new URLSearchParams(params).toString();
        url  = `${this.baseUrl}${endpoint}${qs ? '?' + qs : ''}`;
        sign = signed ? this._sign(timestamp, qs) : null;
      } else {
        url  = `${this.baseUrl}${endpoint}`;
        body = JSON.stringify(params);
        sign = signed ? this._sign(timestamp, body) : null;
      }

      const headers = { 'Content-Type': 'application/json' };
      if (signed) {
        headers['X-BAPI-API-KEY']     = this.apiKey;
        headers['X-BAPI-SIGN']        = sign;
        headers['X-BAPI-TIMESTAMP']   = String(timestamp);
        headers['X-BAPI-RECV-WINDOW'] = String(RECV_WINDOW);
      }

      const fetchOpts = { method, headers, signal: AbortSignal.timeout(8000) };
      if (body) fetchOpts.body = body;

      try {
        const res  = await fetch(url, fetchOpts);
        const text = await res.text();
        let json;
        try { json = JSON.parse(text); } catch { throw new Error(`Non-JSON response: ${text.slice(0, 200)}`); }

        if (!res.ok) throw new Error(`Bybit HTTP ${res.status}: ${text.slice(0, 200)}`);

        const code = json?.retCode;
        if (code !== 0) {
          // 10002: timestamp out of sync → resync and retry
          if (code === 10002 && attempt === 0) {
            const srvMs = await this._syncTime();
            this._serverTimeDrift = srvMs - Date.now();
            attempt--;
            continue;
          }
          const e = new Error(`Bybit API error ${code}: ${json?.retMsg ?? text}`);
          e.code  = code;
          e.retCode = code;
          throw e;
        }
        return json.result;
      } catch (err) {
        lastErr = err;
        if (err.code != null) throw err;  // API-level error — never retry
        if (attempt < RETRY_DELAYS.length) await _sleep(RETRY_DELAYS[attempt]);
      }
    }
    throw lastErr;
  }

  // ── Public interface ─────────────────────────────────────────────────────

  async getServerTime() {
    return this._syncTime();
  }

  async getAccountBalance() {
    for (const accountType of ['UNIFIED', 'CONTRACT']) {
      try {
        const data    = await this._request('GET', '/v5/account/wallet-balance', { accountType }, true);
        const account = data?.list?.[0];
        if (!account) continue;
        const usdt = account.coin?.find(c => c.coin === 'USDT');
        // availableToWithdraw / totalAvailableBalance can be empty string in some account configs
        const balance = parseFloat(
          usdt?.availableToWithdraw || usdt?.walletBalance || usdt?.equity ||
          account.totalAvailableBalance || account.totalWalletBalance || 0
        );
        if (balance > 0 || accountType === 'CONTRACT') return balance;
      } catch {}
    }
    return 0;
  }

  async getSymbolInfo(symbol) {
    if (this._symbolInfoCache[symbol]) return this._symbolInfoCache[symbol];
    const data = await this._request('GET', '/v5/market/instruments-info', { category: 'linear', symbol }, false);
    const info = data?.list?.[0];
    if (!info) return { stepSize: 0.001, tickSize: 0.01, minNotional: 1 };
    const result = {
      stepSize:    parseFloat(info.lotSizeFilter?.qtyStep    ?? 0.001),
      tickSize:    parseFloat(info.priceFilter?.tickSize      ?? 0.01),
      minNotional: parseFloat(info.lotSizeFilter?.minOrderAmt ?? info.lotSizeFilter?.minNotionalValue ?? 1),
    };
    this._symbolInfoCache[symbol] = result;
    return result;
  }

  async setLeverage(symbol, leverage) {
    try {
      await this._request('POST', '/v5/position/set-leverage', {
        category:     'linear',
        symbol,
        buyLeverage:  String(leverage),
        sellLeverage: String(leverage),
      }, true);
    } catch (err) {
      // All non-fatal: already set, position active, or Bybit rejects re-calls.
      // These are idempotent setup calls — never abort trade entry.
      console.warn(`[bybit] setLeverage ${symbol} L${leverage}: ${err.message}`);
    }
  }

  async setMarginType(symbol, marginType) {
    try {
      await this._request('POST', '/v5/position/switch-isolated', {
        category:     'linear',
        symbol,
        tradeMode:    marginType === 'isolated' ? 1 : 0,
        buyLeverage:  '2',
        sellLeverage: '2',
      }, true);
    } catch (err) {
      // All non-fatal: already set, position active, or Bybit rejects re-calls.
      // These are idempotent setup calls — never abort trade entry.
      console.warn(`[bybit] setMarginType ${symbol} ${marginType}: ${err.message}`);
    }
  }

  async getMarkPrice(symbol) {
    const data = await this._request('GET', '/v5/market/tickers', { category: 'linear', symbol }, false);
    return parseFloat(data?.list?.[0]?.markPrice ?? 0);
  }

  async placeMarketOrder(symbol, side, qty) {
    const bySide   = side === 'BUY' ? 'Buy' : 'Sell';
    const posSide  = side === 'BUY' ? 'long' : 'short';  // unified account: Buy→long, Sell→short
    const data     = await this._request('POST', '/v5/order/create', {
      category:     'linear',
      symbol,
      side:         bySide,
      orderType:    'Market',
      qty:          String(qty),
      timeInForce:  'IOC',
      positionSide: posSide,
    }, true);
    const orderId = data?.orderId;

    // Bybit MARKET create response has no fill details — poll order history after delay
    await _sleep(FILL_POLL_MS);
    let filledPrice = 0;
    let filledQty   = qty;
    try {
      const hist = await this._request('GET', '/v5/order/history', { category: 'linear', symbol, orderId }, true);
      const o    = hist?.list?.[0];
      if (o) {
        filledPrice = parseFloat(o.avgPrice    ?? 0);
        filledQty   = parseFloat(o.cumExecQty  ?? qty);
      }
    } catch {}

    if (!filledPrice) filledPrice = await this.getMarkPrice(symbol);
    return { orderId, filledPrice, filledQty };
  }

  async placeStopMarket(symbol, side, stopPrice, qty) {
    // Unified account (Full mode): set SL via /v5/position/trading-stop
    // tpslMode MUST be 'Full' explicitly — without it Bybit returns error
    // Full mode only supports 1 SL total
    try {
      await this._request('POST', '/v5/position/trading-stop', {
        category:    'linear',
        symbol,
        stopLoss:    String(stopPrice),
        slTriggerBy: 'MarkPrice',
        slOrderType: 'Market',
        tpslMode:    'Full',
      }, true);
      return { orderId: null };
    } catch (err) {
      throw err;
    }
  }

  async placeTakeProfitMarket(symbol, side, stopPrice, qty) {
    // Unified account (Full mode): set TP1 via /v5/position/trading-stop
    // tpslMode MUST be 'Full' explicitly
    // Full mode only supports 1 TP total — TP2/TP3 use placeConditionalMarket()
    try {
      await this._request('POST', '/v5/position/trading-stop', {
        category:    'linear',
        symbol,
        takeProfit:  String(stopPrice),
        tpTriggerBy: 'MarkPrice',
        tpOrderType: 'Market',
        tpslMode:    'Full',
      }, true);
      return { orderId: null };
    } catch (err) {
      throw err;
    }
  }

  async placeConditionalMarket(symbol, side, stopPrice, qty, positionSide) {
    // Place a conditional (trigger) market order for TP2/TP3 in Full mode
    // Full mode trading-stop only supports 1 SL + 1 TP, so extra levels use Order API
    const posSide = positionSide === 'LONG' ? 'short' : 'long';
    const data    = await this._request('POST', '/v5/order/create', {
      category:      'linear',
      symbol,
      side:          side === 'BUY' ? 'Buy' : 'Sell',
      orderType:     'Market',
      qty:           String(qty),
      timeInForce:   'GTC',
      positionSide:  posSide,
      triggerPrice:  String(stopPrice),
      triggerBy:     'MarkPrice',
      triggerDirection: side === 'BUY' ? 2 : 1,  // 1=Up, 2=Down
      orderFilter:   'StopOrder',
    }, true);
    return { orderId: data?.orderId };
  }

  async getPosition(symbol) {
    const data = await this._request('GET', '/v5/position/list', { category: 'linear', symbol }, true);
    const pos  = data?.list?.find(p => parseFloat(p.size) > 0);
    if (!pos) return { size: 0, entryPrice: 0, side: null, stopLoss: null, takeProfit: null };
    // Full mode: stopLoss/takeProfit are empty strings when not set
    // Treat empty string as null for trade-executor verification
    const sl = pos.stopLoss && pos.stopLoss !== '' ? parseFloat(pos.stopLoss) : null;
    const tp = pos.takeProfit && pos.takeProfit !== '' ? parseFloat(pos.takeProfit) : null;
    return {
      size:         parseFloat(pos.size),
      entryPrice:   parseFloat(pos.avgPrice ?? pos.entryPrice ?? 0),
      side:         pos.side === 'Buy' ? 'LONG' : pos.side === 'Sell' ? 'SHORT' : null,
      stopLoss:     sl,
      takeProfit:   tp,
    };
  }

  async getOpenOrders(symbol) {
    // Query both regular and conditional (Stop/TP) orders
    const [regular, stops] = await Promise.all([
      this._request('GET', '/v5/order/realtime', { category: 'linear', symbol, orderFilter: 'Order' },     true).catch(() => ({ list: [] })),
      this._request('GET', '/v5/order/realtime', { category: 'linear', symbol, orderFilter: 'StopOrder' }, true).catch(() => ({ list: [] })),
    ]);
    return [...(regular?.list ?? []), ...(stops?.list ?? [])].map(o => ({
      orderId:   o.orderId,
      type:      o.stopOrderType || o.orderType,
      side:      o.side === 'Buy' ? 'BUY' : 'SELL',
      stopPrice: parseFloat(o.triggerPrice ?? 0),
      origQty:   parseFloat(o.qty ?? 0),
      status:    o.orderStatus,
    }));
  }

  async cancelOrder(symbol, orderId) {
    await this._request('POST', '/v5/order/cancel', { category: 'linear', symbol, orderId }, true);
  }

  async closePosition(symbol, positionSide) {
    const closeSide = positionSide === 'LONG' ? 'Sell' : 'Buy';
    const posSide   = positionSide === 'LONG' ? 'short' : 'long';
    const pos       = await this.getPosition(symbol);
    if (!pos.size) return;
    await this._request('POST', '/v5/order/create', {
      category:     'linear',
      symbol,
      side:         closeSide,
      orderType:    'Market',
      qty:          String(pos.size),
      reduceOnly:   true,
      positionSide: posSide,
    }, true);
  }
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { BybitExchange };
