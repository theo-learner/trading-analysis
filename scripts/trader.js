/**
 * trader.js — 거래소 API 실행 레이어
 *
 * 역할: signal-judge.js에서 승인된 OrderParams를 거래소 API로 전송.
 *       dry-run 모드에서는 실제 주문 없이 trades/dry-run/ 에 JSON 기록.
 *
 * 지원 거래소: Bybit (우선), Binance Futures
 * TODO: 구현 필요 (dry-run 우선)
 *
 * @module trader
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const cfg  = require('./config/trader.json');

const PROJECT_ROOT  = path.resolve(__dirname, '..');
const DRY_RUN_DIR   = path.join(PROJECT_ROOT, 'trades', 'dry-run');
const LIVE_DIR      = path.join(PROJECT_ROOT, 'trades', 'live');

/**
 * @param {OrderParams} order
 * @returns {Promise<TradeResult>}
 */
async function executeOrder(order) {
  if (cfg.mode === 'dry-run') {
    return dryRunOrder(order);
  }

  if (cfg.mode === 'live') {
    // TODO: 실제 거래소 API 호출
    // return await sendToExchange(order, cfg.exchange.default);
    throw new Error('Live trading not yet implemented. Set mode to "dry-run" in trader.json');
  }

  throw new Error(`Unknown mode: ${cfg.mode}`);
}

/**
 * Dry-run: 주문 JSON을 trades/dry-run/ 에 저장
 */
function dryRunOrder(order) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename  = `${timestamp}_${order.pair}_${order.direction}.json`;
  const filepath  = path.join(DRY_RUN_DIR, filename);

  const record = {
    mode: 'dry-run',
    timestamp: new Date().toISOString(),
    order,
    result: 'SIMULATED',
  };

  fs.mkdirSync(DRY_RUN_DIR, { recursive: true });
  fs.writeFileSync(filepath, JSON.stringify(record, null, 2));

  console.log(`[trader][dry-run] 주문 기록: ${filename}`);
  console.log(`  ${order.direction} ${order.pair} @ ${order.entry} | SL: ${order.sl} | TP1: ${order.tp?.[0]}`);

  return { success: true, mode: 'dry-run', file: filepath };
}

// TODO: sendToExchange() — Bybit / Binance REST API 구현

module.exports = { executeOrder };

if (require.main === module) {
  // 테스트용 더미 주문
  const testOrder = {
    pair: 'BTCUSDT',
    direction: 'LONG',
    entry: 65000,
    sl: 63500,
    tp: [67000, 69000, 72000],
  };
  executeOrder(testOrder).then(r => console.log('[trader] 결과:', r));
}
