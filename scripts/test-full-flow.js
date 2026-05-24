#!/usr/bin/env node
'use strict';

/**
 * Full live entry test via trade-executor: entry + SL + TP1/2/3 (Partial mode)
 * Usage: TRADING_LIVE=1 node test-full-flow.js [PAIR] [DIRECTION]
 * Example: TRADING_LIVE=1 node test-full-flow.js ZECUSDT LONG
 */

const pair = process.argv[2] || 'ZECUSDT';
const direction = (process.argv[3] || 'LONG').toUpperCase();

if (process.env.TRADING_LIVE !== '1') {
  console.log('⚠️  TRADING_LIVE=1 설정 (live 진입 테스트)');
  process.env.TRADING_LIVE = '1';
}

const traderConfig = require('./config/trader.json');
const { judgeSignal } = require('./signal-judge');
const tradeExecutor = require('./trade-executor');
const { getExchange } = require('./exchanges/index');

// Current price approximation
const prices = {
  BTCUSDT:  77000, ETHUSDT: 2120, SOLUSDT: 86,
  HYPEUSDT: 61, ZECUSDT: 635, MORPHOUSDT: 2.15,
};

const price = prices[pair] || 500;
const isLong = direction === 'LONG';

const signal = {
  pair, direction, tier: 1, confidence: 'HIGH',
  entry: { price, basis: 'POI_RETEST', killzone: 'New_London' },
  sl: isLong ? price * 0.95 : price * 1.05,
  tp: isLong
    ? [price * 1.15, price * 1.20, price * 1.25]
    : [price * 0.85, price * 0.80, price * 0.75],
  rr: 3.0,
  currentPrice: price,
  scorecard: { sizeMultiplier: 1, grade: 'A', oteZone: 'OTE' },
  tradeBlocked: false,
  structure: { htfTrend: isLong ? 'bull' : 'bear', ltfTrend: isLong ? 'bull' : 'bear' },
};

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log(`  FULL LIVE TEST — ${pair} ${direction}`);
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Pre-check balance
  const exchange = getExchange('bybit', traderConfig);
  const bal = await exchange.getAccountBalance();
  console.log(`1. Balance: $${bal.toFixed(2)}`);

  // 2. Close existing position if any
  try {
    const posData = await exchange._request('GET', '/v5/position/list', { category: 'linear', symbol: pair }, true);
    for (const pos of posData?.list || []) {
      if (parseFloat(pos.size) > 0) {
        const closeSide = pos.side === 'Buy' ? 'Sell' : 'Buy';
        await exchange._request('POST', '/v5/order/create', {
          category: 'linear', symbol: pair, side: closeSide, orderType: 'Market',
          qty: pos.size, reduceOnly: true, positionSide: closeSide.toLowerCase(),
        }, true);
        console.log(`2. Closed existing ${pair} position`);
      }
    }
  } catch (e) {}
  await new Promise(r => setTimeout(r, 500));

  // 3. Judge signal
  console.log(`\n3. Judge signal...`);
  const verdict = judgeSignal(signal, traderConfig);
  if (!verdict.approved) {
    console.log(`  ❌ Rejected: ${verdict.reason}`);
    process.exit(1);
  }
  console.log(`  ✅ Approved: ${verdict.reason}`);

  // 4. Execute trade (via trade-executor — full flow: entry → SL → TP1/2/3)
  console.log(`\n4. Executing trade (LIVE)...`);
  console.log(`  Entry: $${price} | SL: $${signal.sl} | TP: [${signal.tp.join(', ')}]`);
  console.log(`  Notional: $${traderConfig.execution.notionalUsd} | Leverage: ${traderConfig.execution.leverage}x\n`);

  const result = await tradeExecutor.execute(signal, verdict, traderConfig, { env: process.env });

  console.log(`\n📋 Execute result:`);
  console.log(`  Status: ${result.status}`);
  console.log(`  Closed reason: ${result.closedReason || '(open)'}`);
  console.log(`  Entry filled: $${result.entry?.filled || 'N/A'}`);
  console.log(`  Qty: ${result.qty}`);
  console.log(`  SL: ${result.sl?.orderId || 'N/A'} (attempts: ${result.sl?.placementAttempts || 0})`);
  console.log(`  Errors: ${result.errors?.map(e => `${e.stage}: ${e.message}`).join(', ') || 'none'}`);
  console.log(`  TP slots:`);
  for (const tp of result.tp) {
    console.log(`    TP${tp.level}: $${tp.price} qty=${tp.qty} id=${tp.orderId}`);
  }

  // 5. Verify on exchange
  await new Promise(r => setTimeout(r, 1500));
  console.log(`\n5. Exchange verification:`);

  // Position
  const all = await exchange._request('GET', '/v5/position/list', { category: 'linear', settleCoin: 'USDT' }, true);
  for (const p of all?.list || []) {
    console.log(`  Position: ${p.symbol} size=${p.size} side=${p.side}`);
  }
  if (!(all?.list?.length > 0)) {
    console.log(`  ⚠️  No open position found`);
  }

  // Stop orders
  try {
    const orders = await exchange._request('GET', '/v5/order/realtime', { category: 'linear', symbol: pair, orderFilter: 'StopOrder' }, true);
    console.log(`  Stop orders: ${orders?.list?.length || 0}`);
    for (const o of orders?.list || []) {
      console.log(`    ${o.orderType} qty=${o.qty} trigger=${o.triggerPrice || o.triggerBy || '-'} status=${o.orderStatus}`);
    }
  } catch (e) {
    console.log(`  Stop order check failed: ${e.message}`);
  }

  // Summary
  console.log(`\n═══════════════════════════════════════════════════`);
  if (result.status === 'closed' && result.closedReason === 'sl_placement_failed') {
    console.log(`  ⚠️  EMERGENCY CLOSE triggered — SL not placed`);
  } else if (result.status === 'open') {
    console.log(`  ✅ TRADE ACTIVE — SL + TP1/2/3 set`);
  } else {
    console.log(`  ℹ️  Trade: ${result.status} (${result.closedReason || 'unknown'})`);
  }
  console.log('═══════════════════════════════════════════════════');
}

main().catch(e => console.error('Fatal error:', e.message));
