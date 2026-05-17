'use strict';

function detectLiquiditySweeps(candles, swings, { followThroughLookforward }) {
  const sweeps = [];
  const highs = swings.filter(s => s.type === 'high');
  const lows  = swings.filter(s => s.type === 'low');

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];

    for (const swing of highs) {
      if (swing.index >= i) continue;
      if (c.high > swing.price && c.close < swing.price) {
        const confirmed = checkFollowThrough(candles, i, 'BSL', followThroughLookforward);
        sweeps.push({ index: i, time: c.time, price: swing.price, close: c.close, type: 'BSL', confirmed });
        break;
      }
    }

    for (const swing of lows) {
      if (swing.index >= i) continue;
      if (c.low < swing.price && c.close > swing.price) {
        const confirmed = checkFollowThrough(candles, i, 'SSL', followThroughLookforward);
        sweeps.push({ index: i, time: c.time, price: swing.price, close: c.close, type: 'SSL', confirmed });
        break;
      }
    }
  }

  return sweeps;
}

function checkFollowThrough(candles, sweepIdx, sweepType, lookforward) {
  const sweepClose = candles[sweepIdx].close;
  const end = Math.min(sweepIdx + lookforward, candles.length - 1);
  for (let i = sweepIdx + 1; i <= end; i++) {
    if (sweepType === 'BSL' && candles[i].close < sweepClose) return true;
    if (sweepType === 'SSL' && candles[i].close > sweepClose) return true;
  }
  return false;
}

module.exports = { detectLiquiditySweeps };
