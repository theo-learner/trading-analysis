#!/usr/bin/env node
'use strict';

/**
 * 6개 페어 E2E 순차 테스트 — TG 알림 + Bybit 지정가 주문 검증
 *
 * 사용법:
 *   TRADING_LIVE=1 TELEGRAM_NOTIFY=1 node test-e2e-all.js
 *
 * 결과 파일:
 *   test/e2e-results-YYYYMMDD-HHMMSS.json
 */

process.env.TRADING_LIVE    = '1';
process.env.TELEGRAM_NOTIFY = '1';

const fs           = require('node:fs');
const path         = require('node:path');
const traderConfig = require('./config/trader.json');
const { judgeSignal }  = require('./signal-judge');
const tradeExecutor    = require('./trade-executor');
const { notifySignal } = require('./notify');
const { getExchange }  = require('./exchanges/index');

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'HYPEUSDT', 'ZECUSDT', 'MORPHOUSDT'];
const DIRECTION = 'LONG';

const results = [];
const issues  = [];

function sep()  { console.log('═══════════════════════════════════════════════════════'); }
function line() { console.log('───────────────────────────────────────────────────────'); }

function recordIssue(pair, step, message, detail = null) {
  const entry = { pair, step, message, ...(detail ? { detail } : {}) };
  issues.push(entry);
  console.log(`  ⚠️  [ISSUE] ${step}: ${message}`);
}

async function fetchMarkPrice(pair) {
  const res  = await fetch(
    `https://api.bybit.com/v5/market/tickers?category=linear&symbol=${pair}`,
    { signal: AbortSignal.timeout(8000) }
  );
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const json = await res.json();
  const mark = parseFloat(json.result?.list?.[0]?.markPrice ?? 0);
  if (!mark) throw new Error(`markPrice 없음`);
  return mark;
}

function roundToTick(price) {
  if (price >= 10000) return Math.round(price * 10) / 10;
  if (price >= 100)   return Math.round(price * 100) / 100;
  if (price >= 1)     return Math.round(price * 1000) / 1000;
  return Math.round(price * 10000) / 10000;
}

async function testPair(pair) {
  const result = {
    pair,
    direction: DIRECTION,
    steps: {},
    passed: false,
    orderId: null,
    entryPrice: null,
    sl: null,
    tp: null,
    rr: null,
  };

  console.log(`\n  ▶ ${pair} ${DIRECTION}`);
  line();

  // ── 1. 현재가 조회 ────────────────────────────────────────────────────────
  let currentPrice;
  try {
    currentPrice = await fetchMarkPrice(pair);
    console.log(`  현재가: $${currentPrice}`);
    result.steps.price = { ok: true, value: currentPrice };
  } catch (e) {
    recordIssue(pair, 'price', `mark price 조회 실패: ${e.message}`);
    result.steps.price = { ok: false, error: e.message };
    return result;
  }

  // ── 2. 시그널 생성 ────────────────────────────────────────────────────────
  const entryRaw = currentPrice * 0.993;
  const entry    = roundToTick(entryRaw);
  const sl       = roundToTick(entry * 0.97);
  // TP를 역산: entry + risk * minRR * 1.01 → 반올림 후에도 R:R ≥ minRR 보장
  const risk     = entry - sl;
  const minRR    = traderConfig.risk.minRR ?? 2;
  const tp       = roundToTick(entry + risk * minRR * 1.01);
  const rr       = parseFloat((Math.abs(tp - entry) / Math.abs(entry - sl)).toFixed(2));

  result.entryPrice = entry;
  result.sl         = sl;
  result.tp         = tp;
  result.rr         = rr;

  const signal = {
    pair,
    direction: DIRECTION,
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
    structure:   { htfTrend: 'bull', ltfTrend: 'bull' },
  };

  // ── 3. judgeSignal ────────────────────────────────────────────────────────
  const verdict = judgeSignal(signal, traderConfig);
  if (!verdict.approved) {
    recordIssue(pair, 'judge', `거부됨: ${verdict.reason}`);
    result.steps.judge = { ok: false, reason: verdict.reason };
    return result;
  }
  result.steps.judge = { ok: true };
  console.log(`  판단: ✅ ${verdict.reason}`);

  // ── 4. Bybit 잔액/포지션 사전 확인 ───────────────────────────────────────
  const exchange = getExchange('bybit', traderConfig);
  try {
    const bal = await exchange.getAccountBalance();
    if (bal < traderConfig.execution.marginUsd) {
      recordIssue(pair, 'preflight', `잔액 부족: $${bal.toFixed(2)}`);
      result.steps.preflight = { ok: false, error: `잔액 부족 $${bal.toFixed(2)}` };
      return result;
    }
    const pos = await exchange.getPosition(pair);
    if (pos.size > 0) {
      recordIssue(pair, 'preflight', `기존 포지션 존재: ${pos.size} ${pos.side} @ $${pos.entryPrice}`);
      result.steps.preflight = { ok: false, error: '기존 포지션 존재' };
      return result;
    }
    result.steps.preflight = { ok: true, balance: bal };
    console.log(`  잔액: $${bal.toFixed(2)} ✅ | 포지션: 없음 ✅`);
  } catch (e) {
    recordIssue(pair, 'preflight', `확인 실패: ${e.message}`);
    result.steps.preflight = { ok: false, error: e.message };
    return result;
  }

  // ── 5. trade-executor (LIVE) ──────────────────────────────────────────────
  let tradeResult;
  try {
    tradeResult = await tradeExecutor.execute(signal, verdict, traderConfig, { env: process.env });
  } catch (e) {
    recordIssue(pair, 'execute', `주문 실패: ${e.message}`);
    result.steps.execute = { ok: false, error: e.message };
    return result;
  }

  if (tradeResult.preflightFailed) {
    recordIssue(pair, 'execute', `Preflight 실패: ${tradeResult.reason}`);
    result.steps.execute = { ok: false, error: tradeResult.reason };
    return result;
  }
  if (tradeResult.dryRun) {
    recordIssue(pair, 'execute', 'dry-run 모드로 실행됨 (TRADING_LIVE=1 필요)');
    result.steps.execute = { ok: false, error: 'dry-run' };
    return result;
  }

  result.orderId = tradeResult.entry?.orderId;
  result.steps.execute = { ok: true, orderId: result.orderId, qty: tradeResult.qty, status: tradeResult.status };
  console.log(`  주문: ✅ ${result.orderId} qty=${tradeResult.qty} status=${tradeResult.status}`);

  // ── 6. 오더북 확인 ───────────────────────────────────────────────────────
  let orderFound = false;
  let priceMatch = false;
  try {
    const openOrders = await exchange._request('GET', '/v5/order/realtime', {
      category: 'linear', symbol: pair, orderFilter: 'Order',
    }, true);
    const matched = (openOrders?.list ?? []).find(o => o.orderId === result.orderId);

    if (matched) {
      orderFound = true;
      priceMatch = Math.abs(parseFloat(matched.price) - entry) < 0.01 * entry;
      console.log(`  오더북: ✅ ${matched.side} Limit $${matched.price} qty=${matched.qty} | 가격일치=${priceMatch ? '✅' : '❌'}`);
      if (!priceMatch) {
        recordIssue(pair, 'verify', `진입가 불일치 — 주문=$${matched.price} 시그널=$${entry}`);
      }
    } else {
      // history 확인
      const hist = await exchange._request('GET', '/v5/order/history', {
        category: 'linear', symbol: pair, limit: '3',
      }, true);
      const histOrder = hist?.list?.find(o => o.orderId === result.orderId);
      if (histOrder) {
        orderFound = true;
        console.log(`  오더북: ℹ️ 이미 처리됨 status=${histOrder.orderStatus}`);
      } else {
        recordIssue(pair, 'verify', `주문을 오더북/히스토리에서 찾을 수 없음 (${result.orderId})`);
      }
    }
    result.steps.verify = { ok: orderFound, priceMatch };
  } catch (e) {
    recordIssue(pair, 'verify', `오더북 조회 실패: ${e.message}`);
    result.steps.verify = { ok: false, error: e.message };
  }

  // ── 7. Telegram ───────────────────────────────────────────────────────────
  let tgResult;
  try {
    tgResult = await notifySignal(signal, traderConfig, { verdict, tradeResult, env: process.env });
  } catch (e) {
    tgResult = { sent: false, error: e.message };
  }

  if (tgResult.sent) {
    console.log(`  TG: ✅ 발송 성공`);
    result.steps.telegram = { ok: true };
  } else {
    const reason = tgResult.error ?? tgResult.skipped ?? '알 수 없음';
    if (tgResult.skipped === 'duplicate') {
      // 동일 세션 내 24h dedup은 정상 동작
      console.log(`  TG: ℹ️ dedup (24h 내 동일 시그널)`);
      result.steps.telegram = { ok: true, note: 'dedup' };
    } else {
      recordIssue(pair, 'telegram', `TG 실패: ${reason}`);
      result.steps.telegram = { ok: false, error: reason };
    }
  }

  // ── 8. 주문 취소 (cleanup) ────────────────────────────────────────────────
  if (result.orderId) {
    try {
      await exchange.cancelOrder(pair, result.orderId);
      console.log(`  취소: ✅ ${result.orderId}`);
      result.steps.cleanup = { ok: true };
    } catch (e) {
      if (/110001|not exist|not found|order does not/i.test(e.message)) {
        console.log(`  취소: ℹ️ 이미 처리됨`);
        result.steps.cleanup = { ok: true, note: 'already_done' };
      } else {
        recordIssue(pair, 'cleanup', `취소 실패: ${e.message} — 수동 확인 필요`, result.orderId);
        result.steps.cleanup = { ok: false, error: e.message };
      }
    }
  } else {
    result.steps.cleanup = { ok: true, note: 'no_order' };
  }

  const allOk = Object.values(result.steps).every(s => s.ok);
  result.passed = allOk;
  return result;
}

async function main() {
  sep();
  console.log('  6-PAIR E2E LIVE TEST');
  sep();
  console.log(`  페어: ${PAIRS.join(', ')}`);
  console.log(`  방향: ${DIRECTION}`);
  console.log(`  거래소: bybit | Notional: $${traderConfig.execution.notionalUsd}\n`);

  for (const pair of PAIRS) {
    const r = await testPair(pair);
    results.push(r);
    // 페어 간 간격 (dedup 충돌 방지)
    if (pair !== PAIRS[PAIRS.length - 1]) await _sleep(2000);
  }

  // ── 결과 파일 저장 ────────────────────────────────────────────────────────
  const now     = new Date();
  const stamp   = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir  = path.join(__dirname, 'test');
  const outFile = path.join(outDir, `e2e-results-${stamp}.json`);

  const payload = {
    runAt:     now.toISOString(),
    direction: DIRECTION,
    summary: {
      total:  PAIRS.length,
      passed: results.filter(r => r.passed).length,
      failed: results.filter(r => !r.passed).length,
    },
    results,
    issues,
  };

  fs.writeFileSync(outFile, JSON.stringify(payload, null, 2));

  // ── 콘솔 요약 ─────────────────────────────────────────────────────────────
  sep();
  console.log('  최종 결과');
  sep();
  for (const r of results) {
    const icon   = r.passed ? '✅' : '❌';
    const price  = r.entryPrice ? `entry=$${r.entryPrice} sl=$${r.sl} tp=$${r.tp}` : '';
    const steps  = Object.entries(r.steps).map(([k, v]) => `${k}:${v.ok ? '✅' : '❌'}`).join(' ');
    console.log(`  ${icon} ${r.pair.padEnd(12)} ${steps}`);
    if (price) console.log(`     ${price} rr=${r.rr}`);
  }

  console.log(`\n  통과: ${payload.summary.passed}/${PAIRS.length} | 이슈: ${issues.length}개`);

  if (issues.length > 0) {
    console.log('\n  이슈 목록:');
    for (const iss of issues) {
      console.log(`    [${iss.pair}] ${iss.step}: ${iss.message}`);
      if (iss.detail) console.log(`      detail: ${iss.detail}`);
    }
  }

  sep();
  console.log(`  결과 파일: ${outFile}`);
  sep();
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

main().catch(err => {
  console.error('\n💥 Runner failed:', err.message);
  process.exit(1);
});
