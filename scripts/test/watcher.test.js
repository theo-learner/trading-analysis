'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { run } = require('../watcher');

function makeSignal(pair) {
  return { pair, direction: 'NEUTRAL', tier: 4, analysisDate: '2026-05-17' };
}

function makeApprovedSignal(pair, bosTime = 1779765000) {
  return {
    pair, direction: 'SHORT', tier: 1, analysisDate: '2026-05-26',
    confidence: 'HIGH', rr: 3.0,
    scorecard: { sizeMultiplier: 1 },
    entry: { price: 2.1722 },
    sl: 2.1837,
    tp: [2.1380],
    tradeBlocked: false, tradeBlockReason: '',
    triggerBOS: { time: bosTime, price: 2.18, direction: 'bear' },
  };
}

function makeDeps(overrides = {}) {
  return {
    fetchCandleSet: async (pair) => ({ htf: [], ltf: [], h1: [], d1: [] }),
    analyzeICT:     (args) => makeSignal(args.pair),
    notifySignal:   async () => ({ sent: false, skipped: 'rejected' }),
    judgeSignal:    () => ({ approved: false, reason: 'NEUTRAL — 방향성 없음' }),
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

  it('unsupported exchange를 가진 페어를 skip하고 나머지를 처리한다 (pre-existing)', async () => {
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

// ─── BOS-trigger dedup ─────────────────────────────────────────────────────

describe('watcher BOS-trigger dedup', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-bos-test-'));
    process.env._TEST_LEDGER_PATH = path.join(tmpDir, 'notifications-sent.json');
  });

  afterEach(() => {
    delete process.env._TEST_LEDGER_PATH;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('동일 BOS time이 ledger에 있으면 notifySignal 스킵', async () => {
    const bosTime = 1779765000;
    const ledgerPath = path.join(tmpDir, 'notifications-sent.json');
    fs.writeFileSync(ledgerPath, JSON.stringify({ entries: [{
      key: `MORPHOUSDT_SHORT_bos_${bosTime}`,
      sentAt: Date.now(),
      pair: 'MORPHOUSDT', direction: 'SHORT', bosTime,
    }] }));

    const notifyCalls = [];
    const logs = [];
    const signal = makeApprovedSignal('MORPHOUSDT', bosTime);
    const deps = makeDeps({
      traderConfig: { pairs: [{ symbol: 'MORPHOUSDT', exchange: 'binance' }] },
      analyzeICT:   () => signal,
      judgeSignal:  () => ({ approved: true, reason: 'test' }),
      notifySignal: async (s) => { notifyCalls.push(s.pair); return { sent: false, skipped: 'test' }; },
      logger: { log: (m) => logs.push(m), warn: () => {} },
    });
    await run(deps);
    assert.equal(notifyCalls.length, 0);
    assert.ok(logs.some(l => l.includes('bos_trigger_dedup')));
  });

  it('triggerBOS.time이 다르면 notifySignal 호출됨', async () => {
    const ledgerPath = path.join(tmpDir, 'notifications-sent.json');
    fs.writeFileSync(ledgerPath, JSON.stringify({ entries: [{
      key: 'MORPHOUSDT_SHORT_bos_1779765000',
      sentAt: Date.now(),
      pair: 'MORPHOUSDT', direction: 'SHORT', bosTime: 1779765000,
    }] }));

    const notifyCalls = [];
    const signal = makeApprovedSignal('MORPHOUSDT', 1779766000); // 다른 BOS time
    const deps = makeDeps({
      traderConfig: { pairs: [{ symbol: 'MORPHOUSDT', exchange: 'binance' }] },
      analyzeICT:   () => signal,
      judgeSignal:  () => ({ approved: true, reason: 'test' }),
      notifySignal: async (s) => { notifyCalls.push(s.pair); return { sent: false, skipped: 'test' }; },
    });
    await run(deps);
    assert.equal(notifyCalls.length, 1);
  });

  it('verdict.approved=false면 BOS 게이트 실행되지 않음', async () => {
    const ledgerPath = path.join(tmpDir, 'notifications-sent.json');
    fs.writeFileSync(ledgerPath, JSON.stringify({ entries: [{
      key: 'MORPHOUSDT_SHORT_bos_1779765000',
      sentAt: Date.now(),
      pair: 'MORPHOUSDT', direction: 'SHORT', bosTime: 1779765000,
    }] }));

    const logs = [];
    const deps = makeDeps({
      traderConfig: { pairs: [{ symbol: 'MORPHOUSDT', exchange: 'binance' }] },
      analyzeICT:   () => makeApprovedSignal('MORPHOUSDT', 1779765000),
      judgeSignal:  () => ({ approved: false, reason: 'test_reject' }),
      logger: { log: (m) => logs.push(m), warn: () => {} },
    });
    await run(deps);
    assert.ok(!logs.some(l => l.includes('bos_trigger_dedup')));
    assert.ok(logs.some(l => l.includes('rejected')));
  });

  it('signal.triggerBOS=null이어도 crash 없음 (Tier2 path)', async () => {
    const signal = { ...makeApprovedSignal('BTCUSDT'), triggerBOS: null, tier: 2 };
    const notifyCalls = [];
    const deps = makeDeps({
      traderConfig: { pairs: [{ symbol: 'BTCUSDT', exchange: 'binance' }] },
      analyzeICT:   () => signal,
      judgeSignal:  () => ({ approved: true, reason: 'test' }),
      notifySignal: async (s) => { notifyCalls.push(s.pair); return { sent: false, skipped: 'test' }; },
    });
    await assert.doesNotReject(() => run(deps));
    assert.equal(notifyCalls.length, 1);
  });

  it('approved-sent path에서 BOS trigger 키가 ledger에 기록됨', async () => {
    const bosTime = 1779765000;
    const signal = makeApprovedSignal('MORPHOUSDT', bosTime);
    const deps = makeDeps({
      traderConfig: { pairs: [{ symbol: 'MORPHOUSDT', exchange: 'binance' }] },
      analyzeICT:   () => signal,
      judgeSignal:  () => ({ approved: true, reason: 'test' }),
      notifySignal: async () => ({ sent: true }),
    });
    await run(deps);
    const ledgerPath = path.join(tmpDir, 'notifications-sent.json');
    const raw = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
    assert.ok(raw.entries.some(e => e.key === `MORPHOUSDT_SHORT_bos_${bosTime}`));
  });
});
