#!/usr/bin/env node
'use strict';

/**
 * Live entry test — dry-run simulation for all 6 pairs.
 * Forces 1x signals through judge + trade-executor without triggering real orders.
 * Usage: TRADING_LIVE=0 node test-live-entry.js
 */

const traderConfig = require('./config/trader.json');
const { judgeSignal } = require('./signal-judge');

// Force TRADING_LIVE=0 → dry-run path in trade-executor
process.env.TRADING_LIVE = '0';

const pairs = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'HYPEUSDT', 'ZECUSDT', 'MORPHOUSDT'];

// Current price approximations (will be overridden by real data if we fetch)
const mockPrices = {
  BTCUSDT:  107000,
  ETHUSDT:  3500,
  SOLUSDT:  145,
  HYPEUSDT: 38,
  ZECUSDT:  630,
  MORPHOUSDT: 620,
};

// Build fake signals that pass ALL real filters except sizeMultiplier
function buildTestSignal(pair) {
  return {
    pair,
    direction: 'LONG',
    tier: 1,
    confidence: 'HIGH',
    entry: { price: mockPrices[pair], basis: 'POI_RETEST', killzone: 'New_London' },
    sl: mockPrices[pair] * 0.95,
    tp: [mockPrices[pair] * 1.15, mockPrices[pair] * 1.20, mockPrices[pair] * 1.25],
    rr: 3.0,
    confidence: 'HIGH',
    currentPrice: mockPrices[pair],
    scorecard: { sizeMultiplier: 1, grade: 'A', oteZone: 'OTE' },
    tradeBlocked: false,
    structure: { htfTrend: 'bull', ltfTrend: 'bull' },
  };
}

async function runTest() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  LIVE ENTRY TEST (DRY-RUN SIMULATION)');
  console.log('═══════════════════════════════════════════════════\n');
  console.log(`Config: mode=${traderConfig.mode}, exchange=${traderConfig.execution.exchange}`);
  console.log(`Leverage=${traderConfig.execution.leverage}, marginUsd=${traderConfig.execution.marginUsd}`);
  console.log(`TRADING_LIVE=${process.env.TRADING_LIVE} (→ dry-run)\n`);

  const tradeExecutor = require('./trade-executor');
  const { judgeSignal: js } = require('./signal-judge');

  let passed = 0;
  let failed = 0;

  for (const pair of pairs) {
    const signal = buildTestSignal(pair);

    // Step 1: judgeSignal
    const verdict = js(signal, traderConfig);
    const judgeOk = verdict.approved;

    if (!judgeOk) {
      console.log(`  ❌ ${pair.padEnd(12)} JUDGE FAIL: ${verdict.reason}`);
      failed++;
      continue;
    }

    // Step 2: trade-executor.execute (dry-run)
    try {
      const result = await tradeExecutor.execute(signal, verdict, traderConfig);
      if (result.dryRun || result.status === 'open') {
        console.log(`  ✅ ${pair.padEnd(12)} → DRY-RUN OK | qty=${result.qty} | entry=$${result.entry?.filled ?? signal.entry.price} | sl=$${result.sl?.price ?? 'N/A'}`);
        passed++;
      } else if (result.preflightFailed) {
        console.log(`  ❌ ${pair.padEnd(12)} → PREFLIGHT FAIL: ${result.reason}`);
        failed++;
      } else {
        console.log(`  ⚠️ ${pair.padEnd(12)} → ${result.status} | reason: ${result.closedReason ?? 'unknown'}`);
        failed++;
      }
    } catch (err) {
      console.log(`  💥 ${pair.padEnd(12)} → EXCEPTION: ${err.message}`);
      failed++;
    }
  }

  console.log(`\n═══════════════════════════════════════════════════`);
  console.log(`  Result: ${passed}/${pairs.length} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════');

  if (failed > 0) {
    console.log('\n⚠️  Failed pairs need attention. Check logs above for details.');
    process.exit(1);
  } else {
    console.log('\n✅  All pairs passed dry-run simulation.');
    process.exit(0);
  }
}

runTest().catch(err => {
  console.error('Test runner failed:', err);
  process.exit(1);
});
