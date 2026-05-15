'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { detectLiquiditySweeps } = require('../../modules/sweep');

function makeCandle(time, open, high, low, close) {
  return { time, open, high, low, close, volume: 1 };
}

const cfg = { followThroughLookforward: 3 };

describe('detectLiquiditySweeps', () => {
  it('ignores candle where wick AND close are both above swing high (not a sweep)', () => {
    // Wick above AND close above swing.price → no reversion → not a sweep
    const swings = [{ type: 'high', index: 0, price: 100 }];
    const candles = [
      makeCandle(0, 95, 100, 94, 98),   // swing high candle
      makeCandle(1, 98, 110, 97, 105),  // wick above + close above → NOT a sweep
    ];
    const sweeps = detectLiquiditySweeps(candles, swings, cfg);
    assert.equal(sweeps.length, 0);
  });

  it('detects BSL sweep confirmed when wick above swing + close below + follow-through', () => {
    const swings = [{ type: 'high', index: 0, price: 100 }];
    const candles = [
      makeCandle(0, 95, 100, 94, 98),   // swing high at 100
      makeCandle(1, 99, 105, 96, 97),   // wick above 100, close=97 < 100 → BSL sweep at idx 1
      makeCandle(2, 97, 98, 88, 89),    // follow-through: close=89 < sweepClose=97 → confirmed
    ];
    const sweeps = detectLiquiditySweeps(candles, swings, cfg);
    assert.equal(sweeps.length, 1);
    assert.equal(sweeps[0].type, 'BSL');
    assert.equal(sweeps[0].confirmed, true);
    assert.equal(sweeps[0].price, 100);
  });

  it('detects BSL sweep unconfirmed when no follow-through within lookforward', () => {
    const swings = [{ type: 'high', index: 0, price: 100 }];
    const candles = [
      makeCandle(0, 95, 100, 94, 98),
      makeCandle(1, 99, 105, 96, 97),   // BSL sweep: wick above, close below
      makeCandle(2, 97, 98, 96, 97),    // close=97, not below sweepClose=97 → no follow-through
      makeCandle(3, 97, 98, 96, 97),    // still no follow-through
      makeCandle(4, 97, 98, 96, 97),    // lookforward=3 → only checks idx 2,3,4 (i=2,3,4)
    ];
    const sweeps = detectLiquiditySweeps(candles, swings, cfg);
    assert.equal(sweeps.length, 1);
    assert.equal(sweeps[0].type, 'BSL');
    assert.equal(sweeps[0].confirmed, false);
  });

  it('detects SSL sweep confirmed when wick below swing low + close above + follow-through', () => {
    const swings = [{ type: 'low', index: 0, price: 100 }];
    const candles = [
      makeCandle(0, 105, 108, 100, 103),  // swing low at 100
      makeCandle(1, 102, 103, 95, 101),   // wick below 100, close=101 > 100 → SSL sweep
      makeCandle(2, 101, 115, 100, 112),  // close=112 > sweepClose=101 → confirmed
    ];
    const sweeps = detectLiquiditySweeps(candles, swings, cfg);
    assert.equal(sweeps.length, 1);
    assert.equal(sweeps[0].type, 'SSL');
    assert.equal(sweeps[0].confirmed, true);
    assert.equal(sweeps[0].price, 100);
  });
});
