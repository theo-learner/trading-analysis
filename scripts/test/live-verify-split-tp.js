#!/usr/bin/env node
/**
 * live-verify-split-tp.js
 *
 * Split-TP 라이브 검증 스크립트.
 * 실제 Bybit/Binance 캔들 데이터로 ICT 분석 후 dry-run execute → position-monitor tick으로
 * 전체 파이프라인(R1:1 50% 익절 → BE 이동 → 시그널 TP 세팅)을 페어별로 검증.
 *
 * 사용법:
 *   node scripts/test/live-verify-split-tp.js [batch]
 *   batch: 1 = BTC+SOL, 2 = HYPE+ZEC, 3 = MORPHO+BNB (default: all)
 */
'use strict';

const path = require('node:path');
const ROOT = path.join(__dirname, '../..');
process.chdir(ROOT);

const { fetchCandleSet } = require('../utils/binance');
const { analyzeICT }    = require('../ict-engine');
const ictConfig         = require('../config/ict-engine.json');
const traderConfig      = require('../config/trader.json');

// Override mode to dry-run for safety
const cfg = { ...traderConfig, mode: 'dry-run' };

const BATCHES = [
  ['BTCUSDT', 'SOLUSDT'],
  ['HYPEUSDT', 'ZECUSDT'],
  ['MORPHOUSDT', 'BNBUSDT'],
];

const PAIR_CHART_SOURCE = {
  HYPEUSDT: 'bybit',
};

// ── Main ─────────────────────────────────────────────────────────────────────

async function verifyPair(pair) {
  const log = (msg) => process.stdout.write(`  ${msg}\n`);
  const chartSource = PAIR_CHART_SOURCE[pair] || 'binance';
  log(`캔들 데이터 수집 중... (${chartSource})`);

  let candles;
  try {
    candles = await fetchCandleSet(pair, { chartSource });
  } catch (err) {
    return { pair, ok: false, step: 'candle_fetch', error: err.message };
  }

  // ICT 분석
  let signal;
  try {
    signal = analyzeICT({ htfCandles: candles.htf, ltfCandles: candles.ltf, d1Candles: candles.d1, pair, config: ictConfig });
  } catch (err) {
    return { pair, ok: false, step: 'ict_analysis', error: err.message };
  }
  log(`ICT: ${signal.direction} | Tier${signal.tier} | ${signal.confidence} | currentPrice=$${signal.currentPrice}`);

  // 시그널이 NEUTRAL이면 합성 신호로 대체 (구조 검증 목적)
  if (signal.direction === 'NEUTRAL' || !signal.entry?.price) {
    const mid = signal.currentPrice || candles.ltf.at(-1)?.close || 100;
    const risk = mid * 0.02;
    signal = {
      ...signal,
      direction:    'LONG',
      tier:         1,
      confidence:   'HIGH',
      entry:        { price: mid * 0.995, basis: 'SYNTH_OB' },
      sl:           mid * 0.995 - risk,
      tp:           [mid * 0.995 + risk * 2],
      rr:           2.0,
      scorecard:    { grade: 'A', sizeMultiplier: 1, action: 'ENTER', breakdown: {} },
    };
    log(`NEUTRAL → 합성 시그널 사용 (entry=$${signal.entry.price.toFixed(4)}, sl=$${signal.sl.toFixed(4)})`);
  }

  // execute (dry-run)
  const { execute } = require('../trade-executor');
  const verdict = { approved: true, reason: 'live_verify', order: { rawQty: cfg.execution.notionalUsd / signal.entry.price } };

  let trade;
  try {
    trade = await execute(signal, verdict, cfg, { env: {} });
  } catch (err) {
    return { pair, ok: false, step: 'execute', error: err.message };
  }

  if (trade.preflightFailed) {
    // 반대 방향 또는 기존 포지션이 막을 경우 — 허용 처리
    log(`⚠️  preflightFailed: ${trade.reason} — 구조 검증 스킵`);
    return { pair, ok: true, step: 'preflight_skip', warn: trade.reason };
  }

  // ── 구조 검증 ──────────────────────────────────────────────────────────────
  const errs = [];

  if (!trade.tp || trade.tp.length !== 2)
    errs.push(`tp 배열 길이 ${trade.tp?.length} (기대: 2)`);

  const risk = Math.abs(signal.entry.price - signal.sl);
  const expectedR1R1 = signal.direction === 'LONG'
    ? signal.entry.price + risk
    : signal.entry.price - risk;

  if (trade.tp?.[0] && Math.abs(trade.tp[0].price - expectedR1R1) > 0.01)
    errs.push(`tp[0].price=${trade.tp[0].price} 기대 R1:1≈${expectedR1R1.toFixed(4)}`);

  if (trade.tp?.[1]?.status !== 'waiting_tp1')
    errs.push(`tp[1].status=${trade.tp?.[1]?.status} (기대: waiting_tp1)`);

  if (trade.tp?.[1]?.orderId !== null)
    errs.push(`tp[1].orderId=${trade.tp?.[1]?.orderId} (기대: null)`);

  const sumQty = parseFloat(((trade.tp?.[0]?.qty || 0) + (trade.tp?.[1]?.qty || 0)).toFixed(8));
  if (Math.abs(sumQty - trade.qty) > 1e-7)
    errs.push(`tp qty 합계=${sumQty} ≠ total=${trade.qty}`);

  if (errs.length > 0) {
    errs.forEach(e => log(`  ✖ ${e}`));
    return { pair, ok: false, step: 'structure', errors: errs };
  }

  log(`✔ tp[0] price=${trade.tp[0].price.toFixed(4)} (R1:1), qty=${trade.tp[0].qty}`);
  log(`✔ tp[1] price=${trade.tp[1].price} (시그널TP), qty=${trade.tp[1].qty}, status=waiting_tp1`);
  log(`✔ qty 합계=${sumQty} = total=${trade.qty}`);

  // ── Position-monitor 시뮬: TP1 filled → BE + TP2 ───────────────────────────
  log(`position-monitor 시뮬레이션 시작 (TP1 체결 가정)...`);

  // 트레이드 레코드를 직접 조작해서 TP1 체결 상태로 세팅 후 tick 실행
  const { saveTrade, openTrades } = require('../utils/trade-store');
  const { tick, _resetReconcileFlag } = require('../position-monitor');

  const slArgs = [], tpArgs = [];
  const fakeExchange = {
    getPosition:           async () => ({ size: trade.tp[1].qty, entryPrice: trade.entry.filled, side: 'LONG', stopLoss: signal.sl, takeProfit: null }),
    getOpenOrders:         async () => [],   // tp1 orderId 사라짐 → filled 감지
    placeStopMarket:       async (s, side, price) => { slArgs.push(+price.toFixed ? price : parseFloat(price)); return { orderId: null }; },
    placeTakeProfitMarket: async (s, side, price) => { tpArgs.push(+price.toFixed ? price : parseFloat(price)); return { orderId: null }; },
    cancelOrder:           async () => {},
    getPositionPnl:        async () => null,
    getSymbolInfo:         async () => ({ stepSize: 0.001, tickSize: 0.01, minNotional: 1 }),
    getAllPositions:        async () => [],
  };

  const origLive = process.env.TRADING_LIVE;
  process.env.TRADING_LIVE = '1';
  _resetReconcileFlag();

  try {
    await tick({ ...cfg, mode: 'live' }, {
      exchangeFn: () => fakeExchange,
      nowFn: () => new Date().toISOString(),
    });
  } finally {
    if (origLive === undefined) delete process.env.TRADING_LIVE;
    else process.env.TRADING_LIVE = origLive;
  }

  // 결과 확인
  const updated = openTrades().find(t => t.id === trade.id);
  const monErrs = [];

  if (!updated) {
    monErrs.push('tick 후 trade 레코드 없음');
  } else {
    if (updated.tp[0]?.status !== 'filled')
      monErrs.push(`tp[0].status=${updated.tp[0]?.status} (기대: filled)`);
    if (updated.tp[1]?.status !== 'pending')
      monErrs.push(`tp[1].status=${updated.tp[1]?.status} (기대: pending)`);
    if (updated.tp[1]?.orderId !== 'tp_trading-stop')
      monErrs.push(`tp[1].orderId=${updated.tp[1]?.orderId} (기대: tp_trading-stop)`);
    const bePrice = trade.entry.filled || trade.entry.requested;
    if (!slArgs.some(p => Math.abs(p - bePrice) < 0.01))
      monErrs.push(`SL이 BE(${bePrice})로 이동되지 않음. slArgs=${JSON.stringify(slArgs)}`);
    const sigTp = signal.tp[0];
    if (!tpArgs.some(p => Math.abs(p - sigTp) < 0.01))
      monErrs.push(`TP2(${sigTp})가 세팅되지 않음. tpArgs=${JSON.stringify(tpArgs)}`);
  }

  if (monErrs.length > 0) {
    monErrs.forEach(e => log(`  ✖ ${e}`));
    return { pair, ok: false, step: 'position_monitor', errors: monErrs };
  }

  log(`✔ tp[0].status=filled`);
  log(`✔ SL → BE(${(trade.entry.filled || trade.entry.requested).toFixed(4)}) 이동 확인`);
  log(`✔ TP2 → 시그널TP(${signal.tp[0]}) 세팅 확인`);
  log(`✔ tp[1].status=pending, orderId=tp_trading-stop`);

  return { pair, ok: true };
}

async function runBatch(pairs, batchNum) {
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`Batch ${batchNum}: ${pairs.join(' + ')}`);
  console.log('═'.repeat(60));

  const results = [];
  for (const pair of pairs) {
    console.log(`\n▶ ${pair}`);
    const r = await verifyPair(pair);
    results.push(r);
    const icon = r.ok ? '✅' : '❌';
    const detail = r.warn ? ` (${r.warn})` : r.errors ? ` [${r.errors.join('; ')}]` : r.error ? ` [${r.error}]` : '';
    console.log(`${icon} ${pair}: ${r.ok ? 'PASS' : 'FAIL'} @ ${r.step || 'complete'}${detail}`);
  }
  return results;
}

async function main() {
  const arg = process.argv[2];
  const batchIdx = arg ? parseInt(arg, 10) - 1 : -1;

  const batches = batchIdx >= 0 ? [[batchIdx, BATCHES[batchIdx]]] : BATCHES.map((b, i) => [i, b]);

  let allPass = true;
  const summary = [];

  for (const [i, pairs] of batches) {
    if (!pairs) { console.error(`Batch ${i + 1} 존재하지 않음`); continue; }
    const results = await runBatch(pairs, i + 1);
    for (const r of results) {
      summary.push(r);
      if (!r.ok) allPass = false;
    }
  }

  console.log(`\n${'═'.repeat(60)}`);
  console.log('검증 결과 요약');
  console.log('═'.repeat(60));
  for (const r of summary) {
    const icon = r.ok ? '✅' : '❌';
    console.log(`${icon}  ${r.pair.padEnd(12)} ${r.ok ? 'PASS' : 'FAIL'}`);
  }
  console.log('═'.repeat(60));
  console.log(allPass ? '\n✅ 모든 페어 검증 완료' : '\n❌ 일부 페어 검증 실패');
  process.exit(allPass ? 0 : 1);
}

main().catch(err => { console.error(err); process.exit(1); });
