/**
 * time-utils.js — 시간 관련 공통 유틸리티
 *
 * 킬존 판별, 타임스탬프 변환, KST 포맷팅 등
 */

'use strict';

const ictConfig = require('../config/ict-engine.json');

/**
 * Unix timestamp(초) → Date 객체
 */
function toDate(unixSec) {
  return new Date(unixSec * 1000);
}

/**
 * Date → KST 포맷 문자열 (YYYY-MM-DD HH:mm KST)
 */
function toKST(date) {
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * 현재 시각이 킬존 내인지 판별
 * @param {Date} [dateUTC=new Date()]
 * @returns {{ inKillzone: boolean, name: string|null }}
 */
function isInKillzone(dateUTC = new Date()) {
  const hour = dateUTC.getUTCHours();
  for (const kz of ictConfig.killzone.utc) {
    if (hour >= kz.start && hour < kz.end) {
      return { inKillzone: true, name: kz.name };
    }
  }
  return { inKillzone: false, name: null };
}

/**
 * 킬존 가중치 보너스 (ict-engine-spec.md §13 기준)
 * @param {{ inKillzone: boolean, name: string|null }} kzResult
 * @returns {number} 0 | 5 | 15
 */
function killzoneBonus(kzResult) {
  if (!kzResult.inKillzone) return 0;
  if (['london', 'new_york'].includes(kzResult.name)) return 15;
  return 5;
}

/**
 * YYYYMMDD 문자열 → Date 객체
 */
function parseDate(yyyymmdd) {
  const y = yyyymmdd.slice(0, 4);
  const m = yyyymmdd.slice(4, 6);
  const d = yyyymmdd.slice(6, 8);
  return new Date(`${y}-${m}-${d}T00:00:00Z`);
}

/**
 * 오늘 날짜 → YYYYMMDD 문자열
 */
function todayStr() {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

module.exports = {
  toDate,
  toKST,
  isInKillzone,
  killzoneBonus,
  parseDate,
  todayStr,
};
