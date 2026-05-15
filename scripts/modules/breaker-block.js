'use strict';

function detectBreakerBlocks(candles, obs, cfg) {
  const { retestMinCandles, retestMaxCandles, immediateReverseCandles } = cfg;
  const bbs = [];

  for (const ob of obs) {
    if (ob.status !== 'invalidated') continue;

    // Find the candle that broke through the OB (full penetration)
    let breakIdx = -1;
    for (let i = ob.index + 1; i < candles.length; i++) {
      if (ob.direction === 'bull' && candles[i].close < ob.low)  { breakIdx = i; break; }
      if (ob.direction === 'bear' && candles[i].close > ob.high) { breakIdx = i; break; }
    }
    if (breakIdx === -1) continue;

    // Appendix B §8: immediate reversal within immediateReverseCandles → reject BB
    let immediateReverse = false;
    const checkEnd = Math.min(breakIdx + immediateReverseCandles, candles.length);
    for (let i = breakIdx + 1; i < checkEnd; i++) {
      if (ob.direction === 'bull' && candles[i].close > ob.low)  { immediateReverse = true; break; }
      if (ob.direction === 'bear' && candles[i].close < ob.high) { immediateReverse = true; break; }
    }
    if (immediateReverse) continue;

    // Find retest within [retestMinCandles, retestMaxCandles] after break
    const retestStart = breakIdx + retestMinCandles;
    const retestEnd   = Math.min(breakIdx + retestMaxCandles, candles.length - 1);
    for (let i = retestStart; i <= retestEnd; i++) {
      const c = candles[i];
      if (c.low <= ob.high && c.high >= ob.low) {
        bbs.push({
          index: ob.index, time: ob.time,
          high: ob.high, low: ob.low,
          direction: ob.direction === 'bull' ? 'bear' : 'bull',
          retestStatus: 'pending', retestIndex: i,
        });
        break;
      }
    }
  }

  return bbs;
}

module.exports = { detectBreakerBlocks };
