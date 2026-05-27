'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSignal(overrides = {}) {
  return {
    pair:         'BTCUSDT',
    direction:    'LONG',
    tier:         1,
    confidence:   'HIGH',
    entry:        { price: 59.78, basis: 'OB' },
    sl:           58.58,        // risk = 1.20, R1:1 = 60.98
    tp:           [62.18],      // signal TP ≈ R2:1
    rr:           2.0,
    currentPrice: 60.32,
    scorecard:    { grade: 'A', sizeMultiplier: 1, action: 'ENTER' },
    structure:    { htfTrend: 'bull', ltfTrend: 'bull' },
    ...overrides,
  };
}

function makeVerdict(overrides = {}) {
  return { approved: true, reason: 'tier1_high', order: { rawQty: 1.0 }, ...overrides };
}

function makeCfg(overrides = {}) {
  return {
    mode: 'dry-run',
    execution: { exchange: 'bybit', leverage: 2, marginUsd: 25, notionalUsd: 50, marginUsdMin: 10, enabled: true },
    position:  { leverage: 2, marginType: 'isolated', maxConcurrent: 6, maxPerPair: 2 },
    trailing:  { enabled: true, moveOnFillConfirmDelayMs: 0 },
    retry:     { orderMaxAttempts: 1, backoffMs: [0] },
    ...overrides,
  };
}

// Each test needs a distinct pair to avoid tradeId collision (tradeId = pair + epoch-minute).
// ETHUSDT is excluded — live store may have open SHORT positions that block LONG entry.
let _pairIdx = 0;
function uniquePair() {
  const pairs = ['BTCUSDT', 'SOLUSDT', 'HYPEUSDT', 'ZECUSDT', 'MORPHOUSDT', 'BNBUSDT'];
  return pairs[_pairIdx++ % pairs.length];
}

// ── trade-executor: dry-run split TP ─────────────────────────────────────────

describe('trade-executor: split TP on dry-run', () => {
  // Load once — pairs differ per test so tradeIds won't collide within a minute
  const { execute } = require('../trade-executor');

  it('tp[0] price is at R1:1, tp[1] price is signal TP', async () => {
    const pair = uniquePair();
    const signal = makeSignal({ pair });
    const result = await execute(signal, makeVerdict(), makeCfg());

    assert.ok(!result.preflightFailed, `preflightFailed: ${result.reason}`);
    assert.equal(result.tp.length, 2, 'should have 2 TP entries');

    const expectedR1R1 = signal.entry.price + Math.abs(signal.entry.price - signal.sl); // 60.98
    assert.ok(
      Math.abs(result.tp[0].price - expectedR1R1) < 0.01,
      `tp[0].price should be ~${expectedR1R1}, got ${result.tp[0].price}`
    );
    assert.equal(result.tp[1].price, 62.18, 'tp[1].price should be signal TP');
  });

  it('tp[0] qty ≤ 50%, tp[1] qty is remainder, sum equals total', async () => {
    const pair = uniquePair();
    const result = await execute(makeSignal({ pair }), makeVerdict(), makeCfg());

    assert.ok(!result.preflightFailed, `preflightFailed: ${result.reason}`);
    assert.ok(result.tp[0].qty > 0, 'tp[0].qty > 0');
    assert.ok(result.tp[1].qty > 0, 'tp[1].qty > 0');
    const sum = parseFloat((result.tp[0].qty + result.tp[1].qty).toFixed(8));
    assert.equal(sum, result.qty, 'tp[0]+tp[1] qty must equal total qty');
    assert.ok(result.tp[0].qty <= result.qty / 2 + 1e-8, 'tp[0] must not exceed 50%');
  });

  it('tp[0] has fake orderId, tp[1] orderId is null (not placed yet)', async () => {
    const pair = uniquePair();
    const result = await execute(makeSignal({ pair }), makeVerdict(), makeCfg());

    assert.ok(!result.preflightFailed, `preflightFailed: ${result.reason}`);
    assert.ok(result.tp[0].orderId, 'tp[0] should have orderId in dry-run');
    assert.equal(result.tp[1].orderId, null, 'tp[1].orderId must be null');
  });

  it('tp[1].status is waiting_tp1 at creation', async () => {
    const pair = uniquePair();
    const result = await execute(makeSignal({ pair }), makeVerdict(), makeCfg());

    assert.ok(!result.preflightFailed, `preflightFailed: ${result.reason}`);
    assert.equal(result.tp[1].status, 'waiting_tp1');
  });

  it('SHORT: tp[0] is entry minus risk (below entry)', async () => {
    const pair = uniquePair();
    const signal = makeSignal({
      pair,
      direction: 'SHORT',
      entry:     { price: 60.00, basis: 'OB' },
      sl:        61.20,
      tp:        [57.60],
    });
    const result = await execute(signal, makeVerdict(), makeCfg());

    assert.ok(!result.preflightFailed, `preflightFailed: ${result.reason}`);
    const expectedR1R1 = 60.00 - Math.abs(60.00 - 61.20); // 58.80
    assert.ok(
      Math.abs(result.tp[0].price - expectedR1R1) < 0.01,
      `SHORT tp[0] should be ~${expectedR1R1}, got ${result.tp[0].price}`
    );
    assert.ok(result.tp[0].price < signal.entry.price, 'SHORT tp[0] must be below entry');
  });
});

// ── position-monitor: TP1 fill → BE move + TP2 placement ─────────────────────

describe('position-monitor: TP1 fill triggers BE move + TP2', () => {
  const { saveTrade, openTrades } = require('../utils/trade-store');
  const { tick, _resetReconcileFlag } = require('../position-monitor');

  const origLive = process.env.TRADING_LIVE;
  before(() => { process.env.TRADING_LIVE = '1'; });
  after(() => {
    if (origLive === undefined) delete process.env.TRADING_LIVE;
    else process.env.TRADING_LIVE = origLive;
  });

  function makeOpenTrade(id, overrides = {}) {
    return {
      id,
      pair:      'SOLUSDT',
      direction: 'LONG',
      exchange:  'bybit',
      status:    'open',
      qty:       1.0,
      entry:     { filled: 59.78, requested: 59.78, requestedAt: new Date().toISOString(), confirmedAt: new Date().toISOString(), slippageBps: 0 },
      sl:        { price: 58.58, orderId: 'sl_trading-stop', placementAttempts: 1 },
      tp: [
        { price: 60.98, qty: 0.5, orderId: 'tp1-real-id', status: 'pending',     filledAt: null, filledPrice: null, basis: 'r1r1' },
        { price: 62.18, qty: 0.5, orderId: null,           status: 'waiting_tp1', filledAt: null, filledPrice: null, basis: 'signal_tp' },
      ],
      slMoves:   [],
      riskCheck: {},
      errors:    [],
      signal:    { pair: 'SOLUSDT', direction: 'LONG', entry: { price: 59.78 }, sl: 58.58, tp: [62.18], rr: 2.0 },
      ...overrides,
    };
  }

  it('marks tp[0] filled and places TP2 when TP1 orderId leaves open orders', async () => {
    const id = `pm-test-${Date.now()}`;
    const trade = makeOpenTrade(id);
    saveTrade(trade);

    const slArgs = [], tpArgs = [];
    const exchange = {
      getPosition:           async () => ({ size: 0.5, entryPrice: 59.78, side: 'LONG', stopLoss: 58.58, takeProfit: null }),
      getOpenOrders:         async () => [],  // TP1 order disappeared → filled
      placeStopMarket:       async (s, side, price) => { slArgs.push(price); return { orderId: null }; },
      placeTakeProfitMarket: async (s, side, price) => { tpArgs.push(price); return { orderId: null }; },
      cancelOrder:           async () => {},
    };

    _resetReconcileFlag();
    await tick(makeCfg({ mode: 'live' }), { exchangeFn: () => exchange, nowFn: () => new Date().toISOString() });

    const updated = openTrades().find(t => t.id === id);
    assert.ok(updated, 'trade should remain in store (not fully closed)');
    assert.equal(updated.tp[0].status, 'filled',      'tp[0] should be marked filled');
    assert.equal(updated.tp[1].status, 'pending',     'tp[1] should now be pending');
    assert.equal(updated.tp[1].orderId, 'tp_trading-stop', 'tp[1] orderId should be tp_trading-stop');

    // SL moved to BE (entry price ≈ 59.78)
    assert.ok(slArgs.some(p => Math.abs(p - 59.78) < 0.01),
      `SL should move to entry ~59.78, got: ${JSON.stringify(slArgs)}`);

    // TP2 placed at signal TP (62.18)
    assert.ok(tpArgs.some(p => Math.abs(p - 62.18) < 0.01),
      `TP2 should be placed at ~62.18, got: ${JSON.stringify(tpArgs)}`);
  });

  it('does NOT re-place TP2 on subsequent ticks after tp[1] is already pending', async () => {
    const id = `pm-test2-${Date.now()}`;
    const trade = makeOpenTrade(id, {
      tp: [
        { price: 60.98, qty: 0.5, orderId: 'tp1-real-id', status: 'filled',     filledAt: new Date().toISOString(), filledPrice: 60.98, basis: 'r1r1' },
        { price: 62.18, qty: 0.5, orderId: 'tp_trading-stop', status: 'pending', filledAt: null, filledPrice: null, basis: 'signal_tp' },
      ],
    });
    saveTrade(trade);

    const tpArgs = [];
    const exchange = {
      getPosition:           async () => ({ size: 0.5, entryPrice: 59.78, side: 'LONG', stopLoss: 59.78, takeProfit: 62.18 }),
      getOpenOrders:         async () => [],
      placeStopMarket:       async () => ({ orderId: null }),
      placeTakeProfitMarket: async (s, side, price) => { tpArgs.push(price); return { orderId: null }; },
      cancelOrder:           async () => {},
    };

    _resetReconcileFlag();
    await tick(makeCfg({ mode: 'live' }), { exchangeFn: () => exchange, nowFn: () => new Date().toISOString() });

    assert.equal(tpArgs.length, 0, 'should NOT call placeTakeProfitMarket again on second tick');
  });
});
