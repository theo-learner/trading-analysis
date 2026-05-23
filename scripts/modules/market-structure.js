'use strict';

function detectBOS(candles, swings) {
  const bos = [];
  const highs = swings.filter(s => s.type === 'high');
  const lows  = swings.filter(s => s.type === 'low');

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    const prevHighs = highs.filter(s => s.index < i);
    if (prevHighs.length > 0) {
      const lastHigh = prevHighs[prevHighs.length - 1];
      if (candle.close > lastHigh.price) {
        bos.push({ index: i, time: candle.time, price: lastHigh.price, close: candle.close, type: 'BOS', direction: 'bull' });
      }
    }

    const prevLows = lows.filter(s => s.index < i);
    if (prevLows.length > 0) {
      const lastLow = prevLows[prevLows.length - 1];
      if (candle.close < lastLow.price) {
        bos.push({ index: i, time: candle.time, price: lastLow.price, close: candle.close, type: 'BOS', direction: 'bear' });
      }
    }
  }
  return bos;
}

function detectMSS(candles, swings) {
  const mss = [];
  const highs = swings.filter(s => s.type === 'high');
  const lows  = swings.filter(s => s.type === 'low');

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const priorSwings = swings.filter(s => s.index < i);
    const trend = getCurrentTrend(priorSwings);

    if (trend === 'bear') {
      const prevHighs = highs.filter(s => s.index < i);
      if (prevHighs.length > 0) {
        const lastHigh = prevHighs[prevHighs.length - 1];
        if (candle.close > lastHigh.price) {
          mss.push({ index: i, time: candle.time, price: lastHigh.price, close: candle.close, type: 'MSS', direction: 'bull' });
        }
      }
    }

    if (trend === 'bull') {
      const prevLows = lows.filter(s => s.index < i);
      if (prevLows.length > 0) {
        const lastLow = prevLows[prevLows.length - 1];
        if (candle.close < lastLow.price) {
          mss.push({ index: i, time: candle.time, price: lastLow.price, close: candle.close, type: 'MSS', direction: 'bear' });
        }
      }
    }
  }
  return mss;
}

function getCurrentTrend(swings) {
  if (swings.length < 6) return 'ranging';
  const last6 = swings.slice(-6);
  const highs = last6.filter(s => s.type === 'high').map(s => s.price);
  const lows  = last6.filter(s => s.type === 'low').map(s => s.price);
  if (highs.length < 3 || lows.length < 3) return 'ranging';
  // Compare first 3 swings with last 3 swings — smoothens out single-wick noise
  const hDelta = highs[2] - highs[0];
  const lDelta = lows[2] - lows[0];
  const range = highs[0] - lows[0];
  const minMove = range * 0.05; // require at least 5% of swing range movement
  // Both highs AND lows must move meaningfully in the same direction for a confirmed trend
  if (hDelta > minMove && lDelta > minMove) return 'bull';
  if (hDelta < -minMove && lDelta < -minMove) return 'bear';
  return 'ranging';
}

function filterByRecentSwings(events, swings, swingCount = 4) {
  if (!Array.isArray(swings) || swings.length === 0) return events.slice();
  if (swings.length < swingCount) return events.slice();
  const cutoffTime = swings[swings.length - swingCount].time;
  return events.filter(e => e.time >= cutoffTime);
}

module.exports = { detectBOS, detectMSS, getCurrentTrend, filterByRecentSwings };
