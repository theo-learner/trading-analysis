'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePair, loadPairs } = require('../../utils/pair-config');

describe('normalizePair()', () => {
  it('문자열을 PairConfig로 정규화한다', () => {
    assert.deepEqual(normalizePair('BTCUSDT'), {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      chartSource: 'binance',
      skipOnError: false,
    });
  });

  it('부분 객체에 기본값을 채운다', () => {
    assert.deepEqual(normalizePair({ symbol: 'ZECUSDT' }), {
      symbol: 'ZECUSDT',
      exchange: 'binance',
      chartSource: 'binance',
      skipOnError: false,
    });
  });

  it('명시된 skipOnError를 보존한다', () => {
    assert.deepEqual(
      normalizePair({ symbol: 'MORPHOUSDT', exchange: 'binance', skipOnError: true }),
      { symbol: 'MORPHOUSDT', exchange: 'binance', chartSource: 'binance', skipOnError: true }
    );
  });

  it('명시된 exchange를 보존한다', () => {
    const result = normalizePair({ symbol: 'XYZUSDT', exchange: 'bybit' });
    assert.equal(result.exchange, 'bybit');
  });

  it('chartSource 가 없으면 exchange 값으로 디폴팅한다', () => {
    assert.deepEqual(normalizePair('BTCUSDT'), {
      symbol: 'BTCUSDT', exchange: 'binance', chartSource: 'binance', skipOnError: false,
    });
    assert.equal(normalizePair({ symbol: 'X', exchange: 'bybit' }).chartSource, 'bybit');
  });

  it('명시된 chartSource 를 보존한다 (exchange 와 달라도)', () => {
    const r = normalizePair({ symbol: 'HYPEUSDT', exchange: 'binance', chartSource: 'bybit' });
    assert.equal(r.exchange, 'binance');
    assert.equal(r.chartSource, 'bybit');
  });
});

describe('loadPairs()', () => {
  it('PairConfig 배열을 반환한다', () => {
    const pairs = loadPairs();
    assert.ok(Array.isArray(pairs));
    assert.ok(pairs.length > 0);
    for (const p of pairs) {
      assert.equal(typeof p.symbol, 'string', 'symbol must be string');
      assert.equal(typeof p.exchange, 'string', 'exchange must be string');
      assert.equal(typeof p.skipOnError, 'boolean', 'skipOnError must be boolean');
    }
  });

  it('모든 symbol이 비어있지 않다', () => {
    const pairs = loadPairs();
    for (const p of pairs) {
      assert.ok(p.symbol.length > 0, `empty symbol found`);
    }
  });
});
