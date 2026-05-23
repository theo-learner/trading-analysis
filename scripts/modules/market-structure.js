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

/**
 * 스윙 기반 trend 계산 (ranging일 경우 price action 보정)
 * @param {Array} swings - 스윙 배열 (정렬됨)
 * @param {Array} candles - 캔들 배열 (option, price action 보정용)
 */
function getCurrentTrend(swings, candles) {
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

  // --- Fallback 1: extend window up to 16 ---
  const maxWindow = Math.min(16, swings.length);
  for (let window = Math.min(8, swings.length); window <= maxWindow; window += 2) {
    const sub = swings.slice(-window);
    const hs = sub.filter(s => s.type === 'high').map(s => s.price);
    const ls = sub.filter(s => s.type === 'low').map(s => s.price);

    if (hs.length >= 2 && ls.length >= 2) {
      return trendFromDelta(hs, ls);
    }
  }

  // --- Fallback 2: single high+low pair ---
  if (highs.length >= 1 && lows.length >= 1) {
    const lastHigh = highs[highs.length - 1];
    const lastLow  = lows[lows.length - 1];

    if (lastHigh.index > lastLow.index) {
      const delta = lastHigh.price - lastLow.price;
      const range = Math.max(...highs.map(h => h)) - Math.min(...lows.map(l => l));
      const minMove = range * 0.03;
      if (delta > minMove) return 'bull';
    } else if (lastLow.index > lastHigh.index) {
      const delta = lastHigh.price - lastLow.price;
      const range = Math.max(...highs.map(h => h)) - Math.min(...lows.map(l => l));
      const minMove = range * 0.03;
      if (delta > minMove) return 'bear';
    }
  }

  return 'ranging';
}

/**
 * 현재 가격 기반 추세 보정
 * - swingTrend가 'ranging'일 때: 가격 흐름 우선
 * - swingTrend가 directional일 때: swing high/low를 뚫고 유지할 때만 보정
 * @param {string} swingTrend - getCurrentTrend() 결과
 * @param {Array} candles - 캔들 배열
 * @returns {string} - 'bull' | 'bear' | 'ranging'
 */
function getPriceActionTrend(swingTrend, candles) {
  if (!candles || candles.length < 5) return swingTrend;

  const n = Math.min(8, candles.length);
  const recent = candles.slice(-n);
  const closes = recent.map(c => c.close);

  // Count direction over last few bars
  let upTrend = 0, downTrend = 0;
  for (let i = 1; i < closes.length; i++) {
    const idx = i - 3;
    if (idx >= 0) {
      if (closes[i] > closes[idx]) upTrend++;
      else if (closes[i] < closes[idx]) downTrend++;
    }
  }

  const threshold = Math.ceil(n / 2);

  // === Ranging: price action fully decides ===
  if (swingTrend === 'ranging') {
    if (upTrend >= threshold) return 'bull';
    if (downTrend >= threshold) return 'bear';
    return 'ranging';
  }

  // === Directional: price action can override only if structure breaks ===
  // Check if recent 3 bars have consistently moved above/below starting level
  const recent3 = closes.slice(-3);
  const startLevel = closes[closes.length - recent3.length - 3] || closes[0];
  const allAbove = recent3.every(c => c > startLevel);
  const allBelow = recent3.every(c => c < startLevel);

  // Only correct if price action direction is OPPOSITE to swing trend
  // AND price is trending (not just a small bounce)
  const bouncePct = Math.abs(closes[closes.length-1] - startLevel) / startLevel * 100;
  if (swingTrend === 'bear' && upTrend >= threshold && allAbove && bouncePct > 1.0) return 'bull';
  if (swingTrend === 'bull' && downTrend >= threshold && allBelow && bouncePct > 1.0) return 'bear';

  return swingTrend;
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

module.exports = { detectBOS, detectMSS, getCurrentTrend, filterByRecentSwings, getPriceActionTrend };
