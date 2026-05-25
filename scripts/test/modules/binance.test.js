'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('binance', () => {
  const { fetchKlines, fetchCandleSet } = require('../../utils/binance');

  it('fetchKlines maps response to candle objects', async () => {
    const candles = await fetchKlines('BTCUSDT', '15m', 5);
    assert.ok(candles.length > 0, 'should return candles');
    assert.ok(typeof candles[0].open === 'number');
    assert.ok(typeof candles[0].high === 'number');
    assert.ok(typeof candles[0].low === 'number');
    assert.ok(typeof candles[0].close === 'number');
    assert.ok(typeof candles[0].volume === 'number');
    assert.ok(typeof candles[0].time === 'number');
  });

  it('fetchCandleSet returns htf/ltf/h1/d1 keys', async () => {
    const result = await fetchCandleSet('BTCUSDT');
    assert.ok(Array.isArray(result.htf));
    assert.ok(Array.isArray(result.ltf));
    assert.ok(Array.isArray(result.h1));
    assert.ok(Array.isArray(result.d1));
    assert.ok(result.htf.length > 0, 'htf should have data');
    assert.ok(result.ltf.length > 0, 'ltf should have data');
  });

  it('fetchKlines fallback: binance for pairs not on Bybit', async () => {
    // ZECUSDT is not on Bybit spot, should fallback to Binance
    const candles = await fetchKlines('ZECUSDT', '4h', 10);
    assert.ok(candles.length > 0, 'ZECUSDT should get data from Binance fallback');
    assert.ok(candles.length <= 10);
  });

  it('fetchKlines module exists and exports fetchKlines and fetchCandleSet', () => {
    assert.equal(typeof fetchKlines, 'function');
    assert.equal(typeof fetchCandleSet, 'function');
  });
});
