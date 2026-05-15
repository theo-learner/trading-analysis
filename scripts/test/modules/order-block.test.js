'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { detectOrderBlocks } = require('../../modules/order-block');

function makeCandle(time, open, high, low, close) {
  return { time, open, high, low, close, volume: 1 };
}

// Mock isDisplacement that always returns true
const alwaysDisplace = () => true;
// Mock isDisplacement that always returns false
const neverDisplace = () => false;

describe('detectOrderBlocks', () => {
  it('detects a bullish order block (bearish candle before bull displacement)', () => {
    const candles = [
      makeCandle(0, 110, 115, 105, 108), // bearish OB candidate (open=110, close=108)
      makeCandle(1, 108, 125, 107, 122), // strong bull displacement (close > prev.high=115)
    ];
    const obs = detectOrderBlocks(candles, [], alwaysDisplace);
    const bullOBs = obs.filter(o => o.direction === 'bull');
    assert.equal(bullOBs.length, 1);
    assert.equal(bullOBs[0].index, 0);
    assert.equal(bullOBs[0].high, 110); // max(open=110, close=108)
    assert.equal(bullOBs[0].low, 108);  // min(open=110, close=108)
    assert.equal(bullOBs[0].status, 'active');
  });

  it('ignores candle without displacement (neverDisplace returns false)', () => {
    const candles = [
      makeCandle(0, 110, 115, 105, 108), // bearish
      makeCandle(1, 108, 125, 107, 122), // would be displacement but fn returns false
    ];
    const obs = detectOrderBlocks(candles, [], neverDisplace);
    assert.equal(obs.length, 0);
  });

  it('marks order block as invalidated when price fully penetrates it', () => {
    const candles = [
      makeCandle(0, 110, 115, 105, 108), // bull OB: high=110, low=108
      makeCandle(1, 108, 125, 107, 122), // displacement
      makeCandle(2, 120, 122, 118, 119), // normal
      makeCandle(3, 119, 118, 104, 106), // close=106 < ob.low=108 → invalidated
    ];
    const obs = detectOrderBlocks(candles, [], alwaysDisplace);
    assert.equal(obs.length, 1);
    assert.equal(obs[0].status, 'invalidated');
  });

  it('detects a bearish order block (bullish candle before bear displacement)', () => {
    const candles = [
      makeCandle(0, 100, 115, 98, 112), // bullish OB (open=100, close=112)
      makeCandle(1, 112, 113, 88, 90),  // strong bear displacement (close < prev.low=98)
    ];
    const obs = detectOrderBlocks(candles, [], alwaysDisplace);
    const bearOBs = obs.filter(o => o.direction === 'bear');
    assert.equal(bearOBs.length, 1);
    assert.equal(bearOBs[0].high, 112); // max(open=100, close=112)
    assert.equal(bearOBs[0].low, 100);  // min(open=100, close=112)
  });
});
