'use strict';

/**
 * Detects order blocks in a candle sequence.
 *
 * An order block is the LAST candle before a displacement move:
 * - Bull OB: bearish candle followed by bull displacement
 * - Bear OB: bullish candle followed by bear displacement
 *
 * @param {Candle[]} candles - array of candles
 * @param {Swing[]} _swings - swing points (unused, for API consistency)
 * @param {Function} isDisplacementFn - function(candle, candles, endIdx) → boolean
 * @returns {OrderBlock[]}
 */
function detectOrderBlocks(candles, _swings, isDisplacementFn) {
  const obs = [];

  // Scan for bull and bear order blocks
  for (let i = 0; i < candles.length - 1; i++) {
    const curr = candles[i];
    const next = candles[i + 1];

    // Bull OB: bearish candle followed by displacement bull
    if (curr.close < curr.open && next.close > curr.high && isDisplacementFn(next, candles, i + 1)) {
      obs.push({
        index: i,
        time: curr.time,
        high: Math.max(curr.open, curr.close),
        low: Math.min(curr.open, curr.close),
        direction: 'bull',
        status: 'active',
      });
    }

    // Bear OB: bullish candle followed by displacement bear
    if (curr.close > curr.open && next.close < curr.low && isDisplacementFn(next, candles, i + 1)) {
      obs.push({
        index: i,
        time: curr.time,
        high: Math.max(curr.open, curr.close),
        low: Math.min(curr.open, curr.close),
        direction: 'bear',
        status: 'active',
      });
    }
  }

  // Invalidate OBs that have been fully penetrated
  for (const ob of obs) {
    for (let i = ob.index + 2; i < candles.length; i++) {
      const close = candles[i].close;
      if (ob.direction === 'bull' && close < ob.low) {
        ob.status = 'invalidated';
        break;
      }
      if (ob.direction === 'bear' && close > ob.high) {
        ob.status = 'invalidated';
        break;
      }
    }
  }

  return obs;
}

module.exports = { detectOrderBlocks };
