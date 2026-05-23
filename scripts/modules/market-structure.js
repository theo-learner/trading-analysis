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
        const lastLow = prevLows.length > 0 ? prevLows[prevLows.length - 1] : null;
        if (lastLow && candle.close < lastLow.price) {
          mss.push({ index: i, time: candle.time, price: lastLow.price, close: candle.close, type: 'MSS', direction: 'bear' });
        }
      }
    }
  }
  return mss;
}

function getCurrentTrend(swings) {
  if (swings.length < 4) return 'ranging';

  const highs = swings.filter(s => s.type === 'high');
  const lows  = swings.filter(s => s.type === 'low');

  // --- Primary: last 6 swings, require both high+low counts >= 3 ---
  const last6 = swings.slice(-6);
  const h6 = last6.filter(s => s.type === 'high').map(s => s.price);
  const l6 = last6.filter(s => s.type === 'low').map(s => s.price);

  if (h6.length >= 3 && l6.length >= 3) {
    return trendFromDelta(h6, l6);
  }

  // --- Fallback: extend window to find enough swings ---
  // Look back up to last 16 swings; accept if we get 2+ highs AND 2+ lows
  for (let window = 10; window <= Math.min(16, swings.length); window += 2) {
    const sub = swings.slice(-window);
    const hs = sub.filter(s => s.type === 'high').map(s => s.price);
    const ls = sub.filter(s => s.type === 'low').map(s => s.price);

    if (hs.length >= 2 && ls.length >= 2) {
      return trendFromDelta(hs, ls);
    }
  }

  // --- Fallback 2: single high+low pair (sharp move detection) ---
  // e.g. low@38 → high@62 (one rally) = bullish
  if (highs.length >= 1 && lows.length >= 1) {
    const lastHigh = highs[highs.length - 1];
    const lastLow  = lows[lows.length - 1];

    // If most recent swing is a HIGH and a prior low exists
    if (lastHigh.index > lastLow.index) {
      const delta = lastHigh.price - lastLow.price;
      const range = Math.max(...highs.map(h => h)) - Math.min(...lows.map(l => l));
      const minMove = range * 0.03;
      if (delta > minMove) return 'bull';
    }
    // If most recent swing is a LOW and a prior high exists
    else if (lastLow.index > lastHigh.index) {
      const delta = lastHigh.price - lastLow.price;
      const range = Math.max(...highs.map(h => h)) - Math.min(...lows.map(l => l));
      const minMove = range * 0.03;
      if (delta > minMove) return 'bear';
    }
  }

  return 'raining';
}

function trendFromDelta(highs, lows) {
  const hDelta = highs[highs.length - 1] - highs[0];
  const lDelta = lows[lows.length - 1] - lows[0];
  const range = highs[0] - lows[0];
  const minMove = range * 0.05;
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
