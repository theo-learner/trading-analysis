'use strict';

const BYBIT_URL = 'https://api.bybit.com/v5/market/kline';
const BINANCE_URL = 'https://api.binance.com/api/v3/klines';
const LIMITS = { htf: 300, ltf: 300, h1: 300, d1: 100 };

// Bybit interval codes (spot)
const TF_CODE = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '2h': '120', '4h': '240', '6h': '360',
  '1d': 'D', '1w': 'W', '1M': 'M',
};

async function fetchBybit(pair, interval, limit) {
  const url = `${BYBIT_URL}?category=spot&symbol=${pair}&interval=${TF_CODE[interval]}&limit=${limit}`;
  const resp = await fetch(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
  });
  if (!resp.ok) throw new Error(`Bybit: ${resp.status}`);
  const data = await resp.json();
  if (data.retCode !== 0) throw new Error(`Bybit: ${data.retMsg}`);

  const raw = data.result.list || [];
  if (raw.length === 0) throw new Error(`Bybit: no data for ${pair}`);

  const cutoff = Date.now();
  return raw
    .map(b => ({
      time:      Math.floor(Number(b[0]) / 1000),
      open:      parseFloat(b[1]),
      high:      parseFloat(b[2]),
      low:       parseFloat(b[3]),
      close:     parseFloat(b[4]),
      volume:    parseFloat(b[5]),
      closeTime: Number(b[0]),
    }))
    .filter(r => r.closeTime <= cutoff)
    .map(({ closeTime, ...rest }) => rest);
}

async function fetchBinance(pair, interval, limit, fn = fetch) {
  const url = `${BINANCE_URL}?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const resp = await fn(url, {
    signal: AbortSignal.timeout(10_000),
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
  });
  if (!resp.ok) throw new Error(`Binance API error: ${resp.status}`);
  const raw = await resp.json();
  if (!Array.isArray(raw) || raw.length === 0) throw new Error(`Binance: no data for ${pair}`);

  const cutoff = Date.now();
  return raw
    .map(b => ({
      time:      Math.floor(Number(b[0]) / 1000),
      open:      parseFloat(b[1]),
      high:      parseFloat(b[2]),
      low:       parseFloat(b[3]),
      close:     parseFloat(b[4]),
      volume:    parseFloat(b[5]),
      closeTime: Number(b[6]),
    }))
    .filter(r => r.closeTime <= cutoff)
    .map(({ closeTime, ...rest }) => rest);
}

async function fetchKlines(pair, interval, limit, fetchFnOrOpts) {
  // Legacy: if a function is passed (test seam), call Binance directly with it
  if (typeof fetchFnOrOpts === 'function') {
    return await fetchBinance(pair, interval, limit, fetchFnOrOpts);
  }

  const opts = fetchFnOrOpts || {};
  // chartSource:'binance' → skip Bybit, avoid 5s timeout waste for Binance-only pairs
  if (opts.chartSource !== 'binance') {
    try {
      return await fetchBybit(pair, interval, limit);
    } catch (err) {
      if (opts.chartSource === 'bybit') throw err; // Bybit-only pair, no Binance fallback
      // Bybit unavailable — fallback to Binance
    }
  }
  return await fetchBinance(pair, interval, limit);
}

async function fetchCandleSet(pair, opts = {}) {
  const [htf, ltf, h1, d1] = await Promise.all([
    fetchKlines(pair, '4h',  LIMITS.htf, opts),
    fetchKlines(pair, '15m', LIMITS.ltf, opts),
    fetchKlines(pair, '1h',  LIMITS.h1, opts),
    fetchKlines(pair, '1d',  LIMITS.d1, opts),
  ]);
  return { htf, ltf, h1, d1 };
}

module.exports = { fetchKlines, fetchCandleSet };
