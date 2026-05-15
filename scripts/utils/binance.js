'use strict';

const BASE_URL = 'https://fapi.binance.com/fapi/v1/klines';
const LIMITS = { htf: 300, ltf: 300, h1: 300, d1: 100 };

async function fetchKlines(pair, interval, limit, fetchFn) {
  const fn = fetchFn || fetch;
  const url = `${BASE_URL}?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const resp = await fn(url);
  if (!resp.ok) throw new Error(`Binance API error: ${resp.status} for ${pair}/${interval}`);
  const raw = await resp.json();
  return raw.map(b => ({
    time: Math.floor(Number(b[0]) / 1000),
    open: parseFloat(b[1]),
    high: parseFloat(b[2]),
    low: parseFloat(b[3]),
    close: parseFloat(b[4]),
    volume: parseFloat(b[5]),
  }));
}

async function fetchCandleSet(pair, fetchFn) {
  const [htf, ltf, h1, d1] = await Promise.all([
    fetchKlines(pair, '4h',  LIMITS.htf, fetchFn),
    fetchKlines(pair, '15m', LIMITS.ltf, fetchFn),
    fetchKlines(pair, '1h',  LIMITS.h1,  fetchFn),
    fetchKlines(pair, '1d',  LIMITS.d1,  fetchFn),
  ]);
  return { htf, ltf, h1, d1 };
}

module.exports = { fetchKlines, fetchCandleSet };
