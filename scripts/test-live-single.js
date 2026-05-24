#!/usr/bin/env node
'use strict';

/**
 * Live entry test for a single pair.
 * Usage: TRADING_LIVE=1 node test-live-single.js PAIR [DIRECTION]
 * Example: TRADING_LIVE=1 node test-live-single.js ZECUSDT LONG
 */

const pair = process.argv[2];
const direction = (process.argv[3] || 'LONG').toUpperCase();

if (!pair) {
  console.error('Usage: TRADING_LIVE=1 node test-live-single.js PAIR [LONG|SHORT]');
  process.exit(1);
}

console.log('═══════════════════════════════════════════════════');
console.log(`  LIVE ENTRY TEST — ${pair} ${direction}`);
console.log('═══════════════════════════════════════════════════\n');

// Ensure live mode
process.env.TRADING_LIVE = '1';

const traderConfig = require('./config/trader.json');
const { judgeSignal } = require('./signal-judge');

// Approximate current prices
const prices = {
  BTCUSDT:  107000,
  ETHUSDT:  3500,
  SOLUSDT:  145,
  HYPEUSDT: 38,
  ZECUSDT:  630,
  MORPHOUSDT: 620,
};

const price = prices[pair] || 500;

const signal = {
  pair,
  direction,
  tier: 1,
  confidence: 'HIGH',
  entry: { price, basis: 'POI_RETEST', killzone: 'New_London' },
  sl: direction === 'LONG' ? price * 0.95 : price * 1.05,
  tp: direction === 'LONG'
    ? [price * 1.15, price * 1.20, price * 1.25]
    : [price * 0.85, price * 0.80, price * 0.75],
  rr: 3.0,
  currentPrice: price,
  scorecard: { sizeMultiplier: 1, grade: 'A', oteZone: 'OTE' },
  tradeBlocked: false,
  structure: { htfTrend: direction === 'LONG' ? 'bull' : 'bear', ltfTrend: direction === 'LONG' ? 'bull' : 'bear' },
};

async function main() {
  // Step 1: Check bybit connection
  console.log('Step 1: Checking Bybit connection...');
  const exchange = require('./exchanges/index').getExchange('bybit', traderConfig);
  
  try {
    const bal = await exchange.getAccountBalance();
    console.log(`  ✅ Balance: $${bal.toFixed(2)}`);
  } catch (e) {
    console.log(`  ❌ Balance check failed: ${e.message}`);
    process.exit(1);
  }

  // Step 2: Check current position
  console.log('Step 2: Checking open positions...');
  try {
    const pos = await exchange.getPosition(pair);
    if (pos.size > 0) {
      console.log(`  ⚠️  Already have position: ${pos.size} ${pos.side || 'LONG'} @ $${pos.entryPrice}`);
      console.log(`  Aborting to avoid double-entry.`);
      process.exit(1);
    }
    console.log('  ✅ No open position');
  } catch (e) {
    console.log(`  ⚠️  Position check failed: ${e.message}`);
  }

  // Step 3: Judge signal
  console.log('Step 3: Running judgeSignal...');
  const verdict = judgeSignal(signal, traderConfig);
  if (!verdict.approved) {
    console.log(`  ❌ Rejected: ${verdict.reason}`);
    process.exit(1);
  }
  console.log(`  ✅ Approved: ${verdict.reason}`);

  // Step 4: Execute trade
  console.log('\nStep 4: Executing trade (LIVE)...');
  console.log(`  Pair: ${pair} | Direction: ${direction}`);
  console.log(`  Entry: $${price} | SL: $${signal.sl}`);
  console.log(`  TP: ${signal.tp.map(t => '$' + t).join(', ')}`);
  console.log(`  Notional: $${traderConfig.execution.notionalUsd} | Leverage: ${traderConfig.execution.leverage}x\n`);

  const tradeExecutor = require('./trade-executor');
  
  try {
    const result = await tradeExecutor.execute(signal, verdict, traderConfig, {
      env: process.env,
    });

    console.log('\n═══════════════════════════════════════════════════');
    if (result.preflightFailed) {
      console.log(`  ⚠️  TRADE SKIPPED: ${result.reason}`);
    } else if (result.dryRun) {
      console.log(`  ✅ DRY-RUN MODE (TRADING_LIVE must be set)`);
    } else {
      console.log(`  ✅ TRADE EXECUTED`);
      console.log(`  Trade ID: ${result.id}`);
      console.log(`  Qty: ${result.qty}`);
      if (result.entry?.filled) {
        console.log(`  Filled: $${result.entry.filled}`);
      }
      if (result.sl?.orderId) {
        console.log(`  SL Order: ${result.sl.orderId}`);
      }
      
      // Verify on exchange
      console.log('\nStep 5: Verifying order on exchange...');
      const pos = await exchange.getPosition(pair);
      if (pos.size > 0) {
        console.log(`  ✅ Confirmed: POS ${pos.size} ${pos.side} @ $${pos.entryPrice}`);
      } else {
        console.log(`  ❌ NOT FOUND on exchange — checking order history...`);
        try {
          const hist = await exchange._request('GET', '/v5/order/history', { category: 'linear', symbol: pair, limit: '3' }, true);
          if (hist?.list?.length > 0) {
            for (const o of hist.list) {
              console.log(`    ${o.symbol} ${o.side} ${o.orderType} qty=${o.qty} status=${o.orderStatus} fill=${o.avgPrice||o.price} reject=${o.rejectReason||'-'}`);
            }
          } else {
            console.log(`    (no orders for ${pair})`);
          }
        } catch(e) {
          console.log(`    Error checking history: ${e.message}`);
        }
      }
      console.log('═══════════════════════════════════════════════════');
    }
  } catch (err) {
    console.log(`\n  💥 ERROR: ${err.message}`);
    console.log('═══════════════════════════════════════════════════');
  }
}

main();
