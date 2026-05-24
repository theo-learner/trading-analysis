'use strict';

/**
 * PnL 계산 유틸리티
 * Bybit linear perpetuals 기준
 */

/** Bybit linear perpetuals 수수료 (maker/taker) */
const BYBIT_FEE_RATE = 0.00075;  // 0.075% per leg

/**
 * PnL 계산
 * @param {object} trade   - trade record (entry, tp, qty, direction, leverage)
 * @param {object} pnlData - { realizedPnl, closePrice, avgEntry } from getPositionPnl()
 * @returns {{ realizedPnl: number, pnlPercent: number, fees: number, fillMethod: string }}
 */
function calcPnl(trade, pnlData) {
  const entryPrice = trade.entry?.filled ?? trade.entry?.entryPrice ?? 0;
  const exitPrice = pnlData?.closePrice ?? pnlData?.realizedPnl_closePrice ?? 0;
  const qty = trade.qty || 0;
  const leverage = trade.leverage || 1;
  const direction = trade.direction;  // 'LONG' or 'SHORT'

  if (!entryPrice || !exitPrice || qty <= 0) {
    return { realizedPnl: null, pnlPercent: null, fees: 0, fillMethod: 'unknown' };
  }

  // Bybit position history의 realizedPnl을 우선 사용 (이미 수수료 차감됨)
  if (pnlData?.realizedPnl != null && pnlData.realizedPnl !== '0') {
    return {
      realizedPnl: parseFloat(pnlData.realizedPnl),
      pnlPercent:  (parseFloat(pnlData.realizedPnl) / entryPrice / qty * leverage * 100).toFixed(4) * 1,
      fees:        0,  // Bybit realizedPnl already deducts fees
      fillMethod:  pnlData.closePrice ? 'bybit_api' : 'fallback',
    };
  }

  // Fallback: entry/exit 가격으로 계산
  let rawPnl;
  if (direction === 'LONG') {
    rawPnl = (exitPrice - entryPrice) * qty;
  } else {
    rawPnl = (entryPrice - exitPrice) * qty;
  }

  // Leverage: margin 기반 PnL
  const margin = (entryPrice * qty) / leverage;
  const pnlPercent = margin > 0 ? (rawPnl / margin * 100) : 0;

  // Fees (2 legs: entry + exit)
  const entryNotional = entryPrice * qty;
  const exitNotional = exitPrice * qty;
  const fees = (entryNotional + exitNotional) * BYBIT_FEE_RATE;
  const realizedPnl = rawPnl - fees;

  return {
    realizedPnl: Math.round(realizedPnl * 100) / 100,
    pnlPercent:  Math.round(pnlPercent * 100) / 100,
    fees:        Math.round(fees * 100) / 100,
    fillMethod:  'calc_fallback',
  };
}

/**
 * Open trade의 미실현 PnL 계산 (현재가 기반)
 */
function calcUnrealizedPnl(trade, markPrice) {
  const entryPrice = trade.entry?.filled ?? trade.entry?.entryPrice ?? 0;
  const qty = trade.qty || 0;
  const leverage = trade.leverage || 1;
  const direction = trade.direction;

  if (!entryPrice || !markPrice || qty <= 0) return 0;

  let pnl;
  if (direction === 'LONG') {
    pnl = (markPrice - entryPrice) * qty;
  } else {
    pnl = (entryPrice - markPrice) * qty;
  }
  return Math.round((pnl / (entryPrice * qty / leverage)) * 100 * 100) / 100;
}

module.exports = { calcPnl, calcUnrealizedPnl, BYBIT_FEE_RATE };
