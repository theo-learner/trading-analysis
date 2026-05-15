'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');

describe('binance', () => {
  const { fetchKlines, fetchCandleSet } = require('../../utils/binance');

  const mockRaw = [
    [1700000000000, '40000', '41000', '39000', '40500', '100'],
    [1700003600000, '40500', '42000', '40000', '41000', '200'],
  ];
  const mockFetch = async (url) => ({
    ok: true,
    json: async () => mockRaw,
  });

  it('fetchKlines maps raw binance array to candle objects', async () => {
    const candles = await fetchKlines('BTCUSDT', '4h', 300, mockFetch);
    assert.equal(candles.length, 2);
    assert.equal(candles[0].open, 40000);
    assert.equal(candles[0].high, 41000);
    assert.equal(candles[0].low, 39000);
    assert.equal(candles[0].close, 40500);
    assert.equal(candles[0].volume, 100);
    assert.equal(candles[0].time, 1700000000);
  });

  it('fetchKlines throws on non-ok response', async () => {
    const badFetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(
      () => fetchKlines('BTCUSDT', '4h', 300, badFetch),
      /Binance API error/
    );
  });

  it('fetchCandleSet returns htf/ltf/h1/d1 keys', async () => {
    const result = await fetchCandleSet('BTCUSDT', mockFetch);
    assert.ok(Array.isArray(result.htf));
    assert.ok(Array.isArray(result.ltf));
    assert.ok(Array.isArray(result.h1));
    assert.ok(Array.isArray(result.d1));
  });

  it('fetchKlines module exists and exports fetchKlines and fetchCandleSet', () => {
    assert.equal(typeof fetchKlines, 'function');
    assert.equal(typeof fetchCandleSet, 'function');
  });
});
