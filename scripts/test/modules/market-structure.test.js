'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { detectBOS, detectMSS, getCurrentTrend } = require('../../modules/market-structure');

function makeCandle(time, open, high, low, close) {
  return { time, open, high, low, close, volume: 1 };
}

describe('detectBOS', () => {
  it('detects bullish BOS when close breaks above prior swing high', () => {
    const swings = [{ index: 1, time: 1000, price: 110, type: 'high' }];
    const candles = [
      makeCandle(0, 100, 112, 98, 105),
      makeCandle(1, 105, 115, 103, 108), // swing high at 115, but index 1
      makeCandle(2, 108, 120, 106, 111), // close 111 > 110? No, use swing price=110
      makeCandle(3, 111, 118, 109, 116), // close 116 > swing high 110 → BOS
    ];
    // swing at index=1, price=110. Candle at index>=2 with close>110 → BOS
    const bos = detectBOS(candles, swings);
    const bullBOS = bos.filter(b => b.direction === 'bull');
    assert.ok(bullBOS.length >= 1);
    assert.ok(bullBOS[0].price === 110); // broken level
  });

  it('does NOT detect BOS on wick breakout (close-only rule)', () => {
    const swings = [{ index: 0, time: 0, price: 110, type: 'high' }];
    const candles = [
      makeCandle(0, 100, 112, 98, 105),
      makeCandle(1, 105, 115, 103, 109), // wick goes to 115 (above 110) but close=109 < 110
      makeCandle(2, 109, 112, 107, 108), // close=108 < 110
    ];
    const bos = detectBOS(candles, swings);
    const bullBOS = bos.filter(b => b.direction === 'bull');
    assert.equal(bullBOS.length, 0);
  });

  it('detects bearish BOS when close breaks below prior swing low', () => {
    const swings = [{ index: 1, time: 1000, price: 100, type: 'low' }];
    const candles = [
      makeCandle(0, 110, 115, 105, 112),
      makeCandle(1, 112, 114, 98, 108),
      makeCandle(2, 108, 110, 97, 99), // close 99 < 100 → bear BOS
    ];
    const bos = detectBOS(candles, swings);
    const bearBOS = bos.filter(b => b.direction === 'bear');
    assert.ok(bearBOS.length >= 1);
    assert.equal(bearBOS[0].price, 100);
  });
});

describe('getCurrentTrend', () => {
  it('returns ranging when fewer than 4 swings', () => {
    const swings = [
      { type: 'high', price: 110 },
      { type: 'low', price: 100 },
    ];
    assert.equal(getCurrentTrend(swings), 'ranging');
  });

  it('returns bull when HH+HL pattern', () => {
    const swings = [
      { type: 'high', price: 110 },
      { type: 'low', price: 100 },
      { type: 'high', price: 120 }, // HH
      { type: 'low', price: 108 },  // HL
    ];
    assert.equal(getCurrentTrend(swings), 'bull');
  });
});

describe('detectMSS', () => {
  it('returns empty array when prior trend is ranging (CHoCH alone is not MSS)', () => {
    // Only 2 swings, trend=ranging. Close breaking swing high should NOT produce MSS.
    const swings = [
      { index: 0, time: 0, price: 110, type: 'high' },
      { index: 1, time: 1, price: 100, type: 'low' },
    ];
    const candles = [
      makeCandle(0, 100, 115, 98, 105),
      makeCandle(1, 105, 112, 103, 108),
      makeCandle(2, 108, 120, 106, 115), // close > 110 but trend was ranging
    ];
    const mss = detectMSS(candles, swings);
    assert.equal(mss.length, 0);
  });
});
