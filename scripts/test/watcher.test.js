'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../watcher');

function makeSignal(pair) {
  return { pair, direction: 'NEUTRAL', tier: 4, analysisDate: '2026-05-17' };
}

function makeDeps(overrides = {}) {
  return {
    fetchCandleSet: async (pair) => ({ htf: [], ltf: [], h1: [], d1: [] }),
    analyzeICT:     (args) => makeSignal(args.pair),
    notifySignal:   async () => ({ sent: false, skipped: 'rejected' }),
    traderConfig:   { pairs: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'HYPEUSDT'] },
    ictConfig:      {},
    logger:         { log: () => {}, warn: () => {} },
    timeoutMs:      5_000,
    ...overrides,
  };
}

describe('watcher.run()', () => {
  it('iterates all pairs and calls notifySignal once per pair', async () => {
    const calls = [];
    const deps = makeDeps({
      notifySignal: async (signal) => {
        calls.push(signal.pair);
        return { sent: false, skipped: 'rejected' };
      },
    });
    await run(deps);
    assert.deepEqual(calls, ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'HYPEUSDT']);
  });

  it('continues processing remaining pairs when one fetchCandleSet throws', async () => {
    const calls = [];
    const deps = makeDeps({
      fetchCandleSet: async (pair) => {
        if (pair === 'ETHUSDT') throw new Error('network error');
        return { htf: [], ltf: [], h1: [], d1: [] };
      },
      notifySignal: async (signal) => {
        calls.push(signal.pair);
        return { sent: false, skipped: 'rejected' };
      },
    });
    await run(deps);
    assert.ok(!calls.includes('ETHUSDT'), 'failed pair should not reach notifySignal');
    assert.ok(calls.includes('BTCUSDT'));
    assert.ok(calls.includes('SOLUSDT'));
    assert.ok(calls.includes('HYPEUSDT'));
  });

  it('rejects with timeout error when work exceeds timeoutMs', async () => {
    const deps = makeDeps({
      fetchCandleSet: () => new Promise(() => {}), // hangs forever
      timeoutMs: 50,
    });
    await assert.rejects(() => run(deps), /watcher run timeout/);
  });

  it('completes without throwing when pairs list is empty', async () => {
    const deps = makeDeps({ traderConfig: { pairs: [] } });
    await assert.doesNotReject(() => run(deps));
  });

  it('logs sent result when notifySignal returns sent=true', async () => {
    const logs = [];
    const deps = makeDeps({
      traderConfig: { pairs: ['BTCUSDT'] },
      notifySignal: async () => ({ sent: true }),
      logger: { log: (msg) => logs.push(msg), warn: () => {} },
    });
    await run(deps);
    assert.ok(logs.some(l => l.includes('SENT')));
  });

  it('unsupported exchange를 가진 페어를 skip하고 나머지를 처리한다', async () => {
    const fetched = [];
    const warned  = [];
    const deps = makeDeps({
      traderConfig: {
        pairs: [
          { symbol: 'BTCUSDT',  exchange: 'binance', skipOnError: false },
          { symbol: 'XYZUSDT',  exchange: 'bybit',   skipOnError: true  },
          { symbol: 'ETHUSDT',  exchange: 'binance', skipOnError: false },
        ],
      },
      fetchCandleSet: async (symbol) => {
        fetched.push(symbol);
        return { htf: [], ltf: [], h1: [], d1: [] };
      },
      logger: {
        log:  () => {},
        warn: (msg) => warned.push(msg),
      },
    });
    await run(deps);
    assert.deepEqual(fetched, ['BTCUSDT', 'ETHUSDT']);
    assert.ok(warned.some(m => m.includes('XYZUSDT') && m.includes('미지원')));
  });
});
