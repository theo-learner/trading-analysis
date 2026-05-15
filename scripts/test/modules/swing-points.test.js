'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { detectSwingPoints } = require('../../modules/swing-points');

function makeCandle(i, open, high, low, close) {
  return { time: i * 1000, open, high, low, close, volume: 1, index: i };
}

describe('detectSwingPoints', () => {
  it('detects a pivot high', () => {
    // candle 2 has the highest high
    const candles = [
      makeCandle(0, 100, 105, 98, 102),
      makeCandle(1, 102, 108, 100, 106),
      makeCandle(2, 106, 115, 104, 110), // pivot high
      makeCandle(3, 110, 112, 106, 108),
      makeCandle(4, 108, 110, 104, 106),
    ];
    const swings = detectSwingPoints(candles, { leftBars: 2, rightBars: 2 });
    const highs = swings.filter(s => s.type === 'high');
    assert.equal(highs.length, 1);
    assert.equal(highs[0].index, 2);
    assert.equal(highs[0].price, 115);
  });

  it('detects a pivot low', () => {
    const candles = [
      makeCandle(0, 110, 115, 108, 112),
      makeCandle(1, 112, 114, 106, 108),
      makeCandle(2, 108, 110,  95, 100), // pivot low
      makeCandle(3, 100, 108,  98, 105),
      makeCandle(4, 105, 110, 103, 108),
    ];
    const swings = detectSwingPoints(candles, { leftBars: 2, rightBars: 2 });
    const lows = swings.filter(s => s.type === 'low');
    assert.equal(lows.length, 1);
    assert.equal(lows[0].index, 2);
    assert.equal(lows[0].price, 95);
  });

  it('ignores candles at boundary (first leftBars and last rightBars)', () => {
    const candles = [
      makeCandle(0, 100, 200, 50, 150), // highest/lowest but at boundary
      makeCandle(1, 102, 108, 100, 106),
      makeCandle(2, 106, 115, 104, 110), // pivot high
      makeCandle(3, 110, 112, 106, 108),
      makeCandle(4, 108, 300, 10, 150),  // highest/lowest but at boundary
    ];
    const swings = detectSwingPoints(candles, { leftBars: 1, rightBars: 1 });
    // candle 0 and 4 should be excluded as candidates
    const all = swings.map(s => s.index);
    assert.ok(!all.includes(0));
    assert.ok(!all.includes(4));
  });

  it('does not detect swing when neighbor ties (strict comparison)', () => {
    // Two equal highs — neither is strictly greater
    const candles = [
      makeCandle(0, 100, 115, 98, 110),
      makeCandle(1, 110, 115, 108, 112), // same high as candle 0
      makeCandle(2, 112, 115, 110, 114), // same high as both
      makeCandle(3, 114, 113, 108, 110),
      makeCandle(4, 110, 112, 106, 108),
    ];
    const swings = detectSwingPoints(candles, { leftBars: 2, rightBars: 2 });
    const highs = swings.filter(s => s.type === 'high');
    // No strict pivot high since ties exist
    assert.equal(highs.length, 0);
  });

  it('§4.2 bug: swing-low push happens after j loop (not inside)', () => {
    // If push happened inside j loop, the low would be pushed multiple times
    // or at wrong moment. Verify we get exactly one swing per pivot.
    const candles = [
      makeCandle(0, 110, 115, 108, 112),
      makeCandle(1, 112, 114, 106, 108),
      makeCandle(2, 108, 110,  95, 100), // single pivot low
      makeCandle(3, 100, 108,  98, 105),
      makeCandle(4, 105, 110, 103, 108),
    ];
    const swings = detectSwingPoints(candles, { leftBars: 2, rightBars: 2 });
    const lows = swings.filter(s => s.type === 'low');
    // Must be exactly 1, not duplicated due to inner loop push bug
    assert.equal(lows.length, 1);
  });
});
