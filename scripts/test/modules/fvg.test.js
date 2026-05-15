'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { detectFVG } = require('../../modules/fvg');

function makeCandle(time, open, high, low, close) {
  return { time, open, high, low, close, volume: 1 };
}

describe('detectFVG', () => {
  it('detects a bullish FVG (c3.low > c1.high)', () => {
    const candles = [
      makeCandle(0, 100, 105, 98, 103),  // c1: high=105
      makeCandle(1, 103, 108, 101, 106), // c2: middle candle
      makeCandle(2, 108, 115, 107, 113), // c3: low=107 > c1.high=105
    ];
    // gap = 107 - 105 = 2, gap/105 ≈ 0.019 > 0.001
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs.length, 1);
    assert.equal(fvgs[0].direction, 'bull');
    assert.equal(fvgs[0].high, 107);
    assert.equal(fvgs[0].low, 105);
    assert.equal(fvgs[0].status, 'active');
  });

  it('detects a bearish FVG (c1.low > c3.high)', () => {
    const candles = [
      makeCandle(0, 110, 115, 108, 112), // c1: low=108
      makeCandle(1, 112, 113, 105, 108), // c2: middle
      makeCandle(2, 108, 107, 100, 103), // c3: high=107 < c1.low=108
    ];
    // gap = 108 - 107 = 1, gap/108 ≈ 0.0093 > 0.001
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs.length, 1);
    assert.equal(fvgs[0].direction, 'bear');
    assert.equal(fvgs[0].high, 108);
    assert.equal(fvgs[0].low, 107);
    assert.equal(fvgs[0].status, 'active');
  });

  it('ignores gap smaller than minGapPct (0.1% threshold)', () => {
    const candles = [
      makeCandle(0, 100, 105.00, 98, 103),
      makeCandle(1, 103, 108,    101, 106),
      makeCandle(2, 108, 115,    105.01, 113), // gap = 0.01/105 ≈ 0.0001 < 0.001
    ];
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs.length, 0);
  });

  it('marks FVG as mitigated when a later candle closes inside it', () => {
    const candles = [
      makeCandle(0, 100, 105, 98, 103),
      makeCandle(1, 103, 108, 101, 106),
      makeCandle(2, 108, 115, 107, 113), // bull FVG: low=105, high=107
      makeCandle(3, 113, 115, 107, 114), // c1.high=108, c3.low=107 → no gap
      makeCandle(4, 114, 115, 104, 106), // close=106 inside FVG [105, 107] → mitigated
    ];
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs.length, 1);
    assert.equal(fvgs[0].status, 'mitigated');
  });

  it('returns empty array when no FVG exists', () => {
    const candles = [
      makeCandle(0, 100, 110, 98, 105),
      makeCandle(1, 105, 108, 100, 104), // overlapping with both neighbors
      makeCandle(2, 104, 107, 99, 103),
    ];
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs.length, 0);
  });
});
