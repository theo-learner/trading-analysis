/**
 * signal-judge.js — 신호 검증 및 진입 파라미터 최종 결정 레이어
 *
 * 역할: ict-engine.js의 ICTSignal을 받아
 *       R:R 필터 → 포지션 사이즈 계산 → 최종 진입 승인/거부 판단
 *
 * 스펙: ict-engine-spec.md §11 (정렬 점수), §14 (신호 스키마), §15 (무효화)
 * TODO: 구현 필요
 *
 * @module signal-judge
 */

'use strict';

const traderConfig = require('./config/trader.json');

/**
 * @param {ICTSignal} signal - ict-engine.js 출력
 * @returns {{ approved: boolean, reason: string, order?: OrderParams }}
 */
function judgeSignal(signal, cfg = traderConfig) {
  // ── 기본 필터 ──────────────────────────────────────────────────────────
  if (signal.direction === 'NEUTRAL') {
    return { approved: false, reason: 'NEUTRAL — 방향성 없음' };
  }

  if (signal.tradeBlocked) {
    return { approved: false, reason: `진입 금지: ${signal.tradeBlockReason}` };
  }

  // ── 티어 필터 ──────────────────────────────────────────────────────────
  if (signal.tier > cfg.signal.maxTier) {
    return { approved: false, reason: `Tier ${signal.tier} — 최대 허용 Tier ${cfg.signal.maxTier} 초과` };
  }

  // ── Confidence 필터 ────────────────────────────────────────────────────
  const confidenceRank = { HIGH: 3, MEDIUM: 2, LOW: 1 };
  const minRank = confidenceRank[cfg.signal.minConfidence] || 2;
  if ((confidenceRank[signal.confidence] || 0) < minRank) {
    return { approved: false, reason: `Confidence ${signal.confidence} — 최소 ${cfg.signal.minConfidence} 필요` };
  }

  // ── R:R 필터 ───────────────────────────────────────────────────────────
  if (signal.rr < cfg.risk.minRR) {
    return { approved: false, reason: `R:R ${signal.rr.toFixed(2)} — 최소 ${cfg.risk.minRR} 미달` };
  }

  // ── 킬존 필터 ──────────────────────────────────────────────────────────
  if (cfg.signal.requireKillzone && !signal.entry.killzone) {
    const isTopGrade = signal.tier === 1 && signal.scorecard?.grade === 'S';
    if (!isTopGrade) {
      return { approved: false, reason: '킬존 외부 — 진입 보류' };
    }
  }

  // ── 사이즈 필터 ────────────────────────────────────────────────────────
  // sizeMultiplier가 1이 아니면 (0.5x 또는 0) Telegram 메시지 건너뜀
  if (signal.scorecard?.sizeMultiplier !== 1) {
    return { approved: false, reason: `Size ${signal.scorecard?.sizeMultiplier ?? '?'}x — 1x만 알림` };
  }

  // ── 포지션 사이즈 계산 (rawQty — stepSize 라운딩은 trade-executor에서) ───
  const notionalUsd = cfg.execution?.notionalUsd ?? 20;
  const rawQty = signal.entry.price > 0 ? notionalUsd / signal.entry.price : 0;

  return {
    approved: true,
    reason: `Tier ${signal.tier} | ${signal.confidence} | R:R ${signal.rr.toFixed(2)}`,
    order: {
      pair:      signal.pair,
      direction: signal.direction,
      entry:     signal.entry.price,
      sl:        signal.sl,
      tp:        signal.tp,
      rawQty,
    }
  };
}

module.exports = { judgeSignal };
