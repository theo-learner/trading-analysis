'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { notifySignal } = require('../notify');

// ─── Fixtures ───────────────────────────────────────────────────────────────

function makeSignal(overrides = {}) {
  return {
    pair: 'BTCUSDT',
    analysisDate: '2026-05-16',
    direction: 'LONG',
    tier: 1,
    confidence: 'HIGH',
    rr: 2.5,
    entry: { price: 45123.5, poi: 'FVG_RETEST', killzone: 'NY_AM' },
    sl: 44950,
    tp: [45470, 45690],
    ...overrides,
  };
}

function makeConfig(overrides = {}) {
  return {
    notifications: {
      telegram: {
        enabled: true,
        chatId: '99999',
        parseMode: 'MarkdownV2',
        ...overrides,
      },
    },
  };
}

const approvedVerdict = {
  approved: true,
  reason: 'Tier 1 | HIGH | R:R 2.50',
  order: { pair: 'BTCUSDT', direction: 'LONG', entry: 45123.5, sl: 44950, tp: [45470, 45690] },
};

const rejectedVerdict = { approved: false, reason: '킬존 외부 — 진입 보류' };

function makeOpts(overrides = {}) {
  return {
    judgeFn: () => approvedVerdict,
    sendFn: async () => ({ ok: true, messageId: 42 }),
    loadCredentialsFn: () => ({ token: 'FAKE_TOKEN', chatId: '99999' }),
    env: { TELEGRAM_NOTIFY: '1' },
    ledgerPath: null,
    ...overrides,
  };
}

// ─── Disabled ───────────────────────────────────────────────────────────────

describe('notifySignal — disabled', () => {
  it('returns skipped:disabled when enabled=false', async () => {
    const result = await notifySignal(
      makeSignal(),
      makeConfig({ enabled: false }),
      makeOpts(),
    );
    assert.equal(result.sent, false);
    assert.equal(result.skipped, 'disabled');
  });

  it('does not call sendFn when disabled', async () => {
    let called = false;
    await notifySignal(
      makeSignal(),
      makeConfig({ enabled: false }),
      makeOpts({ sendFn: async () => { called = true; return { ok: true, messageId: 1 }; } }),
    );
    assert.equal(called, false);
  });
});

// ─── env gate ───────────────────────────────────────────────────────────────

describe('notifySignal — env gate', () => {
  it('returns skipped:env_gate when TELEGRAM_NOTIFY is not "1"', async () => {
    const result = await notifySignal(
      makeSignal(),
      makeConfig(),
      makeOpts({ env: {} }),
    );
    assert.equal(result.sent, false);
    assert.equal(result.skipped, 'env_gate');
  });

  it('returns skipped:env_gate when TELEGRAM_NOTIFY="0"', async () => {
    const result = await notifySignal(
      makeSignal(),
      makeConfig(),
      makeOpts({ env: { TELEGRAM_NOTIFY: '0' } }),
    );
    assert.equal(result.skipped, 'env_gate');
  });
});

// ─── judge rejection ────────────────────────────────────────────────────────

describe('notifySignal — judgeSignal rejection', () => {
  it('returns skipped:rejected when judgeFn returns approved=false', async () => {
    const result = await notifySignal(
      makeSignal(),
      makeConfig(),
      makeOpts({ judgeFn: () => rejectedVerdict }),
    );
    assert.equal(result.sent, false);
    assert.equal(result.skipped, 'rejected');
  });
});

// ─── duplicate ──────────────────────────────────────────────────────────────

describe('notifySignal — dedup', () => {
  it('returns skipped:duplicate on second call with same signal', async () => {
    const os = require('node:os');
    const path = require('node:path');
    const fs = require('node:fs');
    const tmpLedger = path.join(os.tmpdir(), `notify-test-${Date.now()}.json`);

    const opts = makeOpts({ ledgerPath: tmpLedger });

    const first = await notifySignal(makeSignal(), makeConfig(), opts);
    const second = await notifySignal(makeSignal(), makeConfig(), opts);

    assert.equal(first.sent, true);
    assert.equal(second.sent, false);
    assert.equal(second.skipped, 'duplicate');

    try { fs.unlinkSync(tmpLedger); } catch { /* ignore */ }
  });
});

// ─── no credentials ─────────────────────────────────────────────────────────

describe('notifySignal — credentials failure', () => {
  it('returns skipped:no_credentials when loadCredentialsFn throws', async () => {
    const result = await notifySignal(
      makeSignal(),
      makeConfig(),
      makeOpts({
        loadCredentialsFn: () => { throw new Error('token file missing'); },
      }),
    );
    assert.equal(result.sent, false);
    assert.equal(result.skipped, 'no_credentials');
  });
});

// ─── happy path ─────────────────────────────────────────────────────────────

describe('notifySignal — happy path', () => {
  it('sends and records notification, returns sent:true', async () => {
    const os = require('node:os');
    const path = require('node:path');
    const fs = require('node:fs');
    const tmpLedger = path.join(os.tmpdir(), `notify-happy-${Date.now()}.json`);

    let sendCallCount = 0;
    const opts = makeOpts({
      sendFn: async () => { sendCallCount++; return { ok: true, messageId: 77 }; },
      ledgerPath: tmpLedger,
    });

    const result = await notifySignal(makeSignal(), makeConfig(), opts);

    assert.equal(result.sent, true);
    assert.equal(sendCallCount, 1);

    const raw = JSON.parse(fs.readFileSync(tmpLedger, 'utf-8'));
    assert.equal(raw.entries.length, 1);
    assert.equal(raw.entries[0].messageId, 77);

    try { fs.unlinkSync(tmpLedger); } catch { /* ignore */ }
  });
});

// ─── sendFn error ───────────────────────────────────────────────────────────

describe('notifySignal — sendFn throws', () => {
  it('returns skipped:error and does NOT record to ledger', async () => {
    const os = require('node:os');
    const path = require('node:path');
    const fs = require('node:fs');
    const tmpLedger = path.join(os.tmpdir(), `notify-err-${Date.now()}.json`);

    const result = await notifySignal(
      makeSignal(),
      makeConfig(),
      makeOpts({
        sendFn: async () => { throw new Error('network timeout'); },
        ledgerPath: tmpLedger,
      }),
    );

    assert.equal(result.sent, false);
    assert.equal(result.skipped, 'error');
    assert.ok(result.error.includes('network timeout'));

    // Ledger must not have been written
    assert.equal(fs.existsSync(tmpLedger), false);

    try { fs.unlinkSync(tmpLedger); } catch { /* ignore */ }
  });
});
