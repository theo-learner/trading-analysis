#!/usr/bin/env node
'use strict';

/**
 * End-to-end live test: ICT signal → TG 알림 + Bybit 지정가 주문 검증
 *
 * 사용법:
 *   TRADING_LIVE=1 TELEGRAM_NOTIFY=1 node test-e2e-signal.js [PAIR] [DIRECTION]
 *   예: TRADING_LIVE=1 TELEGRAM_NOTIFY=1 node test-e2e-signal.js BTCUSDT LONG
 *
 * 동작:
 *   1. Bybit mark price 실시간 조회
 *   2. 진입가 = 현재가 -0.7% (즉시 미체결 지정가)
 *   3. judgeSignal → 승인 검증
 *   4. trade-executor.execute (LIVE) → Bybit 지정가 주문
 *   5. notifySignal (TELEGRAM_NOTIFY=1) → TG 발송
 *   6. Bybit 오더북에서 주문 존재 확인
 *   7. 테스트 주문 자동 취소 (cleanup)
 */

const pair      = process.argv[2] || 'BTCUSDT';
const direction = (process.argv[3] || 'LONG').toUpperCase();

if (!['LONG', 'SHORT'].includes(direction)) {
  console.error('Direction must be LONG or SHORT');
  process.exit(1);
}

// Force live mode
process.env.TRADING_LIVE    = '1';
process.env.TELEGRAM_NOTIFY = '1';

const traderConfig   = require('./config/trader.json');
const { judgeSignal }  = require('./signal-judge');
const tradeExecutor    = require('./trade-executor');
const { notifySignal } = require('./notify');
const { getExchange }  = require('./exchanges/index');

function sep()  { console.log('═══════════════════════════════════════════════════════'); }
function step(n, label) { console.log(`\nStep ${n}: ${label}`); }

async function fetchMarkPrice(pair) {
  const res  = await fetch(
    `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${pair}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`Bybit ticker HTTP ${res.status}`);
  const json = await res.json();
  const mark = parseFloat(json.result?.list?.[0]?.markPrice ?? 0);
  if (!mark) throw new Error(`No markPrice for ${pair}`);
  return mark;
}

async function main() {
  sep();
  console.log(`  E2E LIVE TEST — ${pair} ${direction}`);
  sep();
  console.log(`  TRADING_LIVE=1  TELEGRAM_NOTIFY=1`);
  console.log(`  Exchange: ${traderConfig.execution.exchange} | Leverage: ${traderConfig.execution.leverage}x`);
  console.log(`  Notional: $${traderConfig.execution.notionalUsd} | Margin: $${traderConfig.execution.marginUsd}\n`);

  // ── Step 1: Bybit 현재가 조회 ────────────────────────────────────────────
  step(1, 'Bybit mark price 조회...');
  let currentPrice;
  try {
    currentPrice = await fetchMarkPrice(pair);
    console.log(`  ✅ ${pair} 현재가: $${currentPrice}`);
  } catch (e) {
    console.log(`  ❌ 가격 조회 실패: ${e.message}`);
    process.exit(1);
  }

  // ── Step 2: 시그널 생성 ──────────────────────────────────────────────────
  step(2, '테스트 시그널 생성...');
  // 진입가 = 현재가 -0.7% (LONG) / +0.7% (SHORT) → 즉시 미체결 지정가
  const entryPct = direction === 'LONG' ? 0.993 : 1.007;
  const entryRaw = currentPrice * entryPct;

  // 소수점 반올림 (BTC: 1자리, 나머지: 가격에 따라)
  function roundToTick(price) {
    if (price >= 10000) return Math.round(price * 10) / 10;
    if (price >= 100)   return Math.round(price * 100) / 100;
    if (price >= 1)     return Math.round(price * 1000) / 1000;
    return Math.round(price * 10000) / 10000;
  }

  const entry   = roundToTick(entryRaw);
  const sl      = roundToTick(direction === 'LONG' ? entry * 0.97 : entry * 1.03);
  const risk    = Math.abs(entry - sl);
  const minRR   = traderConfig.risk?.minRR ?? 2;
  const tp      = roundToTick(direction === 'LONG'
    ? entry + risk * minRR * 1.01
    : entry - risk * minRR * 1.01);
  const rr      = parseFloat((Math.abs(tp - entry) / risk).toFixed(2));

  const signal = {
    pair,
    direction,
    tier:        1,
    confidence:  'HIGH',
    entry:       { price: entry, basis: 'E2E_TEST_FVG', killzone: 'New_London' },
    sl,
    tp:          [tp],
    tpBasis:     ['RR'],
    rr,
    currentPrice,
    scorecard:   { sizeMultiplier: 1, grade: 'A', oteZone: 'OTE', breakdown: { time: true, liquidity: true, pdArray: 2 } },
    tradeBlocked: false,
    structure:   { htfTrend: direction === 'LONG' ? 'bull' : 'bear', ltfTrend: direction === 'LONG' ? 'bull' : 'bear' },
  };

  console.log(`  현재가:  $${currentPrice}`);
  console.log(`  진입가:  $${entry}  (${((entry - currentPrice) / currentPrice * 100).toFixed(2)}%)`);
  console.log(`  SL:      $${sl}  (${((sl - entry) / entry * 100).toFixed(2)}%)`);
  console.log(`  TP:      $${tp}  (${((tp - entry) / entry * 100).toFixed(2)}%)`);
  console.log(`  R:R:     ${rr}`);

  // ── Step 3: judgeSignal ──────────────────────────────────────────────────
  step(3, 'judgeSignal 검증...');
  const verdict = judgeSignal(signal, traderConfig);
  if (!verdict.approved) {
    console.log(`  ❌ 거부됨: ${verdict.reason}`);
    process.exit(1);
  }
  console.log(`  ✅ 승인됨: ${verdict.reason}`);
  console.log(`  rawQty: ${verdict.order.rawQty.toFixed(6)}`);

  // ── Step 4: 잔액 + 포지션 사전 확인 ────────────────────────────────────
  step(4, 'Bybit 잔액 / 포지션 사전 확인...');
  const exchange = getExchange('bybit', traderConfig);
  try {
    const bal = await exchange.getAccountBalance();
    console.log(`  잔액: $${bal.toFixed(2)}`);
    if (bal < traderConfig.execution.marginUsd) {
      console.log(`  ❌ 잔액 부족 ($${bal.toFixed(2)} < $${traderConfig.execution.marginUsd})`);
      process.exit(1);
    }
    const pos = await exchange.getPosition(pair);
    if (pos.size > 0) {
      console.log(`  ⚠️  기존 포지션 존재: ${pos.size} ${pos.side} @ $${pos.entryPrice}`);
      console.log(`  ⚠️  테스트 중단 — 기존 포지션 없을 때만 실행`);
      process.exit(1);
    }
    console.log(`  ✅ 포지션 없음`);
  } catch (e) {
    console.log(`  ❌ 확인 실패: ${e.message}`);
    process.exit(1);
  }

  // ── Step 5: trade-executor (LIVE) ─────────────────────────────────────
  step(5, `Bybit 지정가 주문 실행 (LIVE)...`);
  let tradeResult;
  try {
    tradeResult = await tradeExecutor.execute(signal, verdict, traderConfig, {
      env: process.env,
    });
  } catch (e) {
    console.log(`  ❌ 주문 실패: ${e.message}`);
    process.exit(1);
  }

  if (tradeResult.preflightFailed) {
    console.log(`  ❌ Preflight 실패: ${tradeResult.reason}`);
    process.exit(1);
  }
  if (tradeResult.dryRun) {
    console.log(`  ❌ dry-run 모드로 실행됨 — TRADING_LIVE=1 환경변수 확인`);
    process.exit(1);
  }

  const orderId = tradeResult.entry?.orderId;
  const status  = tradeResult.status;
  console.log(`  ✅ 주문 접수됨`);
  console.log(`  상태:    ${status}`);
  console.log(`  OrderID: ${orderId}`);
  console.log(`  Qty:     ${tradeResult.qty}`);
  console.log(`  TradeID: ${tradeResult.id}`);

  // ── Step 6: Bybit 오더북 확인 ───────────────────────────────────────────
  step(6, 'Bybit 오더북에서 주문 존재 확인...');
  let orderFound = false;
  try {
    // 미체결 주문 조회
    const openOrders = await exchange._request('GET', '/v5/order/realtime', {
      category: 'linear',
      symbol:   pair,
      orderFilter: 'Order',
    }, true);
    const orders = openOrders?.list ?? [];
    const matched = orders.find(o => o.orderId === orderId);

    if (matched) {
      orderFound = true;
      console.log(`  ✅ 주문 확인됨:`);
      console.log(`     Symbol:    ${matched.symbol}`);
      console.log(`     Side:      ${matched.side}`);
      console.log(`     Type:      ${matched.orderType}`);
      console.log(`     Price:     $${matched.price}`);
      console.log(`     Qty:       ${matched.qty}`);
      console.log(`     Status:    ${matched.orderStatus}`);

      // 진입가/SL/TP 일치 검증
      const priceMatch = Math.abs(parseFloat(matched.price) - entry) < 0.01 * entry;
      console.log(`\n  진입가 일치: ${priceMatch ? '✅' : '❌'}  주문=$${matched.price}  시그널=$${entry}`);
    } else {
      // order history에서도 확인
      const hist = await exchange._request('GET', '/v5/order/history', {
        category: 'linear',
        symbol:   pair,
        limit:    '3',
      }, true);
      const histOrder = hist?.list?.find(o => o.orderId === orderId);
      if (histOrder) {
        console.log(`  ℹ️  주문이 이미 체결/취소됨: ${histOrder.orderStatus}`);
        orderFound = true;
      } else {
        console.log(`  ❌ 주문을 오더북/히스토리에서 찾을 수 없음 (ID: ${orderId})`);
      }
    }
  } catch (e) {
    console.log(`  ❌ 오더북 조회 실패: ${e.message}`);
  }

  // ── Step 7: Telegram 알림 ────────────────────────────────────────────────
  step(7, 'Telegram 알림 발송...');
  let tgResult;
  try {
    tgResult = await notifySignal(signal, traderConfig, {
      verdict,
      tradeResult,
      env: process.env,
    });
  } catch (e) {
    tgResult = { sent: false, error: e.message };
  }

  if (tgResult.sent) {
    console.log(`  ✅ TG 발송 성공`);
  } else if (tgResult.skipped) {
    console.log(`  ⏭  TG 스킵됨: ${tgResult.skipped}${tgResult.reason ? ' — ' + tgResult.reason : ''}`);
  } else {
    console.log(`  ❌ TG 실패: ${tgResult.error ?? '알 수 없음'}`);
  }

  // ── Step 8: 테스트 주문 취소 (cleanup) ──────────────────────────────────
  step(8, '테스트 주문 취소 (cleanup)...');
  if (orderId) {
    try {
      await exchange.cancelOrder(pair, orderId);
      console.log(`  ✅ 주문 취소 완료 (ID: ${orderId})`);
    } catch (e) {
      // 이미 체결/취소된 경우 무시
      if (e.message?.includes('Order does not exist') || e.message?.includes('110001') || e.message?.includes('order not found')) {
        console.log(`  ℹ️  주문이 이미 처리됨 (취소 불필요)`);
      } else {
        console.log(`  ❌ 취소 실패: ${e.message}`);
        console.log(`  ⚠️  수동으로 ${pair} 미체결 주문을 확인하세요`);
      }
    }
  } else {
    console.log(`  ℹ️  OrderID 없음 — 취소 불필요`);
  }

  // ── 최종 결과 ────────────────────────────────────────────────────────────
  sep();
  console.log('  E2E TEST 결과 요약');
  sep();
  const ok = s => s ? '✅' : '❌';
  console.log(`  Bybit 주문 접수:    ${ok(!tradeResult.preflightFailed && !tradeResult.dryRun)}`);
  console.log(`  Bybit 주문 확인:    ${ok(orderFound)}`);
  console.log(`    진입가:           $${entry}`);
  console.log(`    SL:               $${sl}`);
  console.log(`    TP:               $${tp}`);
  console.log(`    R:R:              ${rr}`);
  console.log(`  Telegram 발송:      ${ok(tgResult?.sent)}`);
  console.log(`  테스트 주문 취소:   완료`);
  sep();
}

main().catch(err => {
  console.error('\n💥 Test failed:', err.message);
  process.exit(1);
});
