'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { isDisplacement } = require('../../modules/displacement');

const cfg = { rollingWindow: 3, bodyMultiplier: 1.5, maxWickRatio: 0.3, closeAtExtremeRatio: 0.7 };

// helper to build a series of same-size candles for avgBody baseline
function makeCandles(n, bodySize = 10) {
  return Array.from({ length: n }, (_, i) => ({
    time: i, open: 100, high: 110, low: 90, close: 100 + bodySize, volume: 1,
  }));
}

describe('isDisplacement', () => {
  it('returns true for a strong bullish displacement candle', () => {
    // baseline candles: body=10 each, avgBody=10
    // displacement candle: body=20 (> 10*1.5=15), small lower wick, close near top
    const base = makeCandles(5, 10); // open=100, close=110
    const disp = { time: 5, open: 100, high: 125, low: 98, close: 123, volume: 100 };
    // range=27, body=23, oppositeWick=2, closePos=(123-98)/27=0.93
    assert.equal(isDisplacement(disp, base, 5, cfg), true);
  });

  it('returns false when body is too small (< avgBody * bodyMultiplier)', () => {
    const base = makeCandles(5, 10); // avgBody=10, threshold=15
    const small = { time: 5, open: 100, high: 115, low: 98, close: 111, volume: 100 };
    // body=11 < 15 → false
    assert.equal(isDisplacement(small, base, 5, cfg), false);
  });

  it('returns false when opposite wick is too large', () => {
    const base = makeCandles(5, 10);
    // body=20 (> 15), but lower wick is large
    const bigWick = { time: 5, open: 100, high: 125, low: 85, close: 120, volume: 100 };
    // range=40, oppositeWick=15, 15/40=0.375 > 0.3 → false
    assert.equal(isDisplacement(bigWick, base, 5, cfg), false);
  });

  it('returns false when close is not near the extreme', () => {
    const base = makeCandles(5, 10);
    // body=20 (> 15), small wick, but close is in middle of range
    const midClose = { time: 5, open: 100, high: 130, low: 98, close: 115, volume: 100 };
    // range=32, body=15, oppositeWick=2, closePos=(115-98)/32=0.53 < 0.7 → false
    assert.equal(isDisplacement(midClose, base, 5, cfg), false);
  });

  it('returns false when avgBody is zero', () => {
    const zeroCandles = Array.from({ length: 5 }, (_, i) => ({
      time: i, open: 100, high: 100, low: 100, close: 100, volume: 0,
    }));
    const disp = { time: 5, open: 100, high: 125, low: 98, close: 123, volume: 100 };
    assert.equal(isDisplacement(disp, zeroCandles, 5, cfg), false);
  });
});
