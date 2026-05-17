/**
 * signal.js — Killzone 기반 트리거 레이어
 *
 * 역할: 현재 시각이 킬존(런던/뉴욕/아시아) 진입 시점인지 판단하여
 *       ICT 분석 파이프라인(capture → ict-engine → signal-judge)을 기동한다.
 *
 * 스펙: ict-engine-spec.md §13
 * TODO: 구현 필요
 *
 * @module signal
 */

'use strict';

const config = require('./config/ict-engine.json');

// ── Killzone 판별 ──────────────────────────────────────────────────────────
function isInKillzone(dateUTC = new Date()) {
  const hour = dateUTC.getUTCHours();
  for (const kz of config.killzone.utc) {
    if (hour >= kz.start && hour < kz.end) {
      return { inKillzone: true, name: kz.name };
    }
  }
  return { inKillzone: false, name: null };
}

// ── 메인 ──────────────────────────────────────────────────────────────────
async function main() {
  const now = new Date();
  const kz = isInKillzone(now);

  console.log(`[signal] ${now.toISOString()} — killzone: ${kz.inKillzone ? kz.name : 'none'}`);

  if (!kz.inKillzone) {
    console.log('[signal] 킬존 외부 — 파이프라인 스킵');
    process.exit(0);
  }

  console.log(`[signal] 킬존 진입 (${kz.name}) — ICT 파이프라인 기동`);
  // TODO: capture.js 호출 → ict-engine.js → signal-judge.js
}

module.exports = { isInKillzone };

if (require.main === module) {
  main().catch(err => { console.error(err); process.exit(1); });
}
