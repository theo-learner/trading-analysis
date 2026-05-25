'use strict';

const BASE_URL = 'https://api.bybit.com/v5/market/kline';
const LIMITS = { htf: 300, ltf: 300, h1: 300, d1: 100 };

// Bybit interval codes (spot)
const TF_CODE = {
  '1m': '1', '3m': '3', '5m': '5', '15m': '15', '30m': '30',
  '1h': '60', '2h': '120', '4h': '240', '6h': '360',
  '1d': 'D', '1w': 'W', '1M': 'M',
};

async function fetchKlines(pair, interval, limit, fetchFn) {
  const fn = fetchFn || fetch;
  const url = `${BASE_URL}?category=spot&symbol=${pair}&interval=${TF_CODE[interval]}&limit=${limit}`;
  const resp = await fn(url, {
    signal: AbortSignal.timeout(5_000),
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)' },
  });
  if (!resp.ok) throw new Error(`Bybit API error: ${resp.status} for ${pair}/${interval}`);
  const data = await resp.json();
  if (data.retCode !== 0) throw new Error(`Bybit API error: ${data.retMsg} for ${pair}/${interval}`);

  const raw = data.result.list; // [[time, open, high, low, close, volume, ...]]
  const cutoff = Date.now();
  return raw
    .map(b => ({
      time:      Math.floor(Number(b[0]) / 1000),
      open:      parseFloat(b[1]),
      high:      parseFloat(b[2]),
      low:       parseFloat(b[3]),
      close:     parseFloat(b[4]),
      volume:    parseFloat(b[5]),
      closeTime: Number(b[0]), // bybit time is already ms
    }))
    .filter(r => r.closeTime <= cutoff)
    .map(({ closeTime, ...rest }) => rest);
}

async function fetchCandleSet(pair, fetchFn) {
  const [htf, ltf, h1, d1] = await Promise.all([
    fetchKlines(pair, '4h',  LIMITS.htf, fetchFn),
    fetchKlines(pair, '15m', LIMITS.ltf, fetchFn),
    fetchKlines(pair, '1h',  LIMITS.h1, fetchFn),
    fetchKlines(pair, '1d',  LIMITS.d1, fetchFn),
  ]);
  return { htf, ltf, h1, d1 };
}

module.exports = { fetchKlines, fetchCandleSet };
