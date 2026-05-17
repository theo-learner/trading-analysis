'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { fetchKlines } = require('../../utils/binance');

function makeFakeRow(openTime, closeTime) {
  return [
    String(openTime),
    '100', '110', '90', '105', '1000',
    String(closeTime),
    '0', '0', '0', '0', '0',
  ];
}

describe('fetchKlines — partial candle filter', () => {
  it('removes the last row when its closeTime is in the future', async () => {
    const now = Date.now();
    const rows = [
      makeFakeRow(now - 1800_000, now - 900_001), // closed 15m ago
      makeFakeRow(now - 900_000,  now + 500),      // still open
    ];
    const fetch = async () => ({ ok: true, json: async () => rows });
    const result = await fetchKlines('BTCUSDT', '15m', 2, fetch);
    assert.equal(result.length, 1);
  });

  it('keeps all rows when every row is closed', async () => {
    const now = Date.now();
    const rows = [
      makeFakeRow(now - 1800_000, now - 900_001),
      makeFakeRow(now - 900_000,  now - 1),
    ];
    const fetch = async () => ({ ok: true, json: async () => rows });
    const result = await fetchKlines('BTCUSDT', '15m', 2, fetch);
    assert.equal(result.length, 2);
  });

  it('does not include closeTime field in returned rows', async () => {
    const now = Date.now();
    const rows = [makeFakeRow(now - 900_000, now - 1)];
    const fetch = async () => ({ ok: true, json: async () => rows });
    const [row] = await fetchKlines('BTCUSDT', '15m', 1, fetch);
    assert.ok(!('closeTime' in row));
  });

  it('throws on non-ok response', async () => {
    const fetch = async () => ({ ok: false, status: 429 });
    await assert.rejects(
      () => fetchKlines('BTCUSDT', '15m', 1, fetch),
      /Binance API error: 429/,
    );
  });
});
