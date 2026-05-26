'use strict';

const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

let tmpDir;
let ledger;

function freshLedger(ledgerPath) {
  delete require.cache[require.resolve('../../utils/notification-ledger')];
  process.env._TEST_LEDGER_PATH = ledgerPath;
  return require('../../utils/notification-ledger');
}

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ledger-test-'));
  ledger = freshLedger(path.join(tmpDir, 'notifications-sent.json'));
});

afterEach(() => {
  delete process.env._TEST_LEDGER_PATH;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

// ─── dedupKey ───────────────────────────────────────────────────────────────

describe('dedupKey', () => {
  it('includes price rounded to 1 decimal for BTCUSDT', () => {
    const signal = { pair: 'BTCUSDT', analysisDate: '2026-05-16', direction: 'LONG', tier: 1, entry: { price: 65432.7 } };
    assert.equal(ledger.dedupKey(signal), 'BTCUSDT_2026-05-16_LONG_1_65432.7');
  });

  it('includes price rounded to 3 decimals for SOLUSDT', () => {
    const signal = { pair: 'SOLUSDT', analysisDate: '2026-05-16', direction: 'SHORT', tier: 2, entry: { price: 172.4567 } };
    assert.equal(ledger.dedupKey(signal), 'SOLUSDT_2026-05-16_SHORT_2_172.457');
  });

  it('uses NA when entry.price is missing', () => {
    const signal = { pair: 'BTCUSDT', analysisDate: '2026-05-16', direction: 'LONG', tier: 1 };
    assert.equal(ledger.dedupKey(signal), 'BTCUSDT_2026-05-16_LONG_1_NA');
  });

  it('different prices produce different keys', () => {
    const base = { pair: 'ETHUSDT', analysisDate: '2026-05-16', direction: 'LONG', tier: 1 };
    const k1 = ledger.dedupKey({ ...base, entry: { price: 3000.1 } });
    const k2 = ledger.dedupKey({ ...base, entry: { price: 3100.2 } });
    assert.notEqual(k1, k2);
  });

  it('same price within precision produces same key', () => {
    const base = { pair: 'BTCUSDT', analysisDate: '2026-05-16', direction: 'LONG', tier: 1 };
    const k1 = ledger.dedupKey({ ...base, entry: { price: 65432.74 } });
    const k2 = ledger.dedupKey({ ...base, entry: { price: 65432.75 } });
    assert.notEqual(k1, k2);
  });
});

// ─── priceDecimalsFor ───────────────────────────────────────────────────────

describe('priceDecimalsFor', () => {
  it('returns 1 for BTCUSDT', () => assert.equal(ledger.priceDecimalsFor('BTCUSDT'), 1));
  it('returns 1 for ETHUSDT', () => assert.equal(ledger.priceDecimalsFor('ETHUSDT'), 1));
  it('returns 3 for SOLUSDT', () => assert.equal(ledger.priceDecimalsFor('SOLUSDT'), 3));
  it('returns 3 for HYPEUSDT', () => assert.equal(ledger.priceDecimalsFor('HYPEUSDT'), 3));
});

// ─── hasRecentNotification ──────────────────────────────────────────────────

describe('hasRecentNotification', () => {
  it('returns false when ledger file does not exist', () => {
    assert.equal(ledger.hasRecentNotification('ANY_KEY'), false);
  });

  it('returns false for unknown key', () => {
    ledger.recordNotification('OTHER_KEY', { pair: 'ETH', direction: 'SHORT', tier: 2, messageId: 1 });
    assert.equal(ledger.hasRecentNotification('UNKNOWN_KEY'), false);
  });

  it('returns true for a key recorded within 24h', () => {
    ledger.recordNotification('KEY1', { pair: 'BTC', direction: 'LONG', tier: 1, messageId: 10 });
    assert.equal(ledger.hasRecentNotification('KEY1'), true);
  });

  it('returns false for a key older than 24h window', () => {
    const windowMs = 24 * 60 * 60 * 1000;
    const ledgerPath = path.join(tmpDir, 'notifications-sent.json');
    const oldEntry = {
      key: 'OLD_KEY',
      sentAt: Date.now() - windowMs - 1000,
      pair: 'BTC', direction: 'LONG', tier: 1, messageId: 5,
    };
    fs.writeFileSync(ledgerPath, JSON.stringify({ entries: [oldEntry] }));
    ledger = freshLedger(ledgerPath);
    assert.equal(ledger.hasRecentNotification('OLD_KEY'), false);
  });
});

// ─── bosTriggerDedupKey ─────────────────────────────────────────────────────

describe('bosTriggerDedupKey', () => {
  it('triggerBOS 있는 시그널에서 PAIR_DIR_bos_<time> 반환', () => {
    const signal = { pair: 'MORPHOUSDT', direction: 'SHORT', triggerBOS: { time: 1779765000, price: 2.17, direction: 'bear' } };
    assert.equal(ledger.bosTriggerDedupKey(signal), 'MORPHOUSDT_SHORT_bos_1779765000');
  });

  it('triggerBOS=null이면 null 반환', () => {
    const signal = { pair: 'MORPHOUSDT', direction: 'SHORT', triggerBOS: null };
    assert.equal(ledger.bosTriggerDedupKey(signal), null);
  });

  it('triggerBOS 필드 없어도 null 반환 (NEUTRAL/Tier2 시그널)', () => {
    const signal = { pair: 'BTCUSDT', direction: 'LONG' };
    assert.equal(ledger.bosTriggerDedupKey(signal), null);
  });

  it('동일 BOS time + 다른 entry price → 동일 키 (버그 핵심)', () => {
    const bos = { time: 1779765000, price: 2.17, direction: 'bear' };
    const sig1 = { pair: 'MORPHOUSDT', direction: 'SHORT', triggerBOS: bos, entry: { price: 2.1722 } };
    const sig2 = { pair: 'MORPHOUSDT', direction: 'SHORT', triggerBOS: bos, entry: { price: 2.1561 } };
    assert.equal(ledger.bosTriggerDedupKey(sig1), ledger.bosTriggerDedupKey(sig2));
  });

  it('다른 BOS time → 다른 키', () => {
    const sig1 = { pair: 'MORPHOUSDT', direction: 'SHORT', triggerBOS: { time: 1779765000, price: 2.17, direction: 'bear' } };
    const sig2 = { pair: 'MORPHOUSDT', direction: 'SHORT', triggerBOS: { time: 1779766000, price: 2.16, direction: 'bear' } };
    assert.notEqual(ledger.bosTriggerDedupKey(sig1), ledger.bosTriggerDedupKey(sig2));
  });
});

// ─── recordNotification ─────────────────────────────────────────────────────

describe('recordNotification', () => {
  it('persists entry to disk', () => {
    const ledgerPath = path.join(tmpDir, 'notifications-sent.json');
    ledger.recordNotification('K1', { pair: 'SOL', direction: 'SHORT', tier: 2, messageId: 99 });
    const raw = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
    assert.equal(raw.entries.length, 1);
    assert.equal(raw.entries[0].key, 'K1');
    assert.equal(raw.entries[0].messageId, 99);
  });

  it('23h-old BOS 항목은 prune되지 않음 (PRUNE_WINDOW_MS=24h 회귀 가드)', () => {
    const ledgerPath = path.join(tmpDir, 'notifications-sent.json');
    const recentBosEntry = {
      key: 'MORPHOUSDT_SHORT_bos_1779765000',
      sentAt: Date.now() - 23 * 60 * 60 * 1000,
      pair: 'MORPHOUSDT', direction: 'SHORT', bosTime: 1779765000,
    };
    fs.writeFileSync(ledgerPath, JSON.stringify({ entries: [recentBosEntry] }));
    ledger = freshLedger(ledgerPath);

    ledger.recordNotification('NEW_KEY', { pair: 'ETH', direction: 'SHORT', tier: 1, messageId: 2 });

    const raw = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
    assert.equal(raw.entries.length, 2);
    assert.ok(raw.entries.some(e => e.key === 'MORPHOUSDT_SHORT_bos_1779765000'));
  });

  it('prunes entries older than 24h on write', () => {
    const windowMs = 24 * 60 * 60 * 1000;
    const ledgerPath = path.join(tmpDir, 'notifications-sent.json');
    const oldEntry = {
      key: 'OLD',
      sentAt: Date.now() - windowMs - 1000,
      pair: 'BTC', direction: 'LONG', tier: 1, messageId: 1,
    };
    fs.writeFileSync(ledgerPath, JSON.stringify({ entries: [oldEntry] }));
    ledger = freshLedger(ledgerPath);

    ledger.recordNotification('NEW_KEY', { pair: 'ETH', direction: 'SHORT', tier: 1, messageId: 2 });

    const raw = JSON.parse(fs.readFileSync(ledgerPath, 'utf-8'));
    assert.equal(raw.entries.length, 1);
    assert.equal(raw.entries[0].key, 'NEW_KEY');
  });
});
