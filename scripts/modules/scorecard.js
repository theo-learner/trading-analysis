'use strict';

function calculateEntryScorecard(params) {
  const {
    htfTrend, entryDirection, killzoneResult,
    entryPrice, swingHigh, swingLow,
    entryZone, activeFVGs, activeOBs, activeBBs,
    sweeps, entryTimeSecs, tier, cfg,
  } = params;

  const ocfg = cfg.scorecard;

  const s1 = scoreStructure(htfTrend, entryDirection);
  const s2 = scoreTime(killzoneResult);
  const s3 = scorePrice(entryPrice, swingHigh, swingLow, entryDirection, ocfg.ote);
  const s4 = scorePDArray(entryZone, activeFVGs, activeOBs, activeBBs);
  const s5 = scoreLiquidity(sweeps, entryTimeSecs, ocfg.liquidity.lookbackCandles);

  const total = s1 + s2 + s3 + s4 + s5;
  const grade = getScoreGrade(total, ocfg.gradeThresholds);
  const oteZone = classifyOTE(entryPrice, swingHigh, swingLow, entryDirection, ocfg.ote);
  const decision = finalEntryDecision(tier, grade);

  return {
    total,
    breakdown: { structure: s1, time: s2, price: s3, pdArray: s4, liquidity: s5 },
    grade,
    oteZone,
    action: decision.action,
    sizeMultiplier: decision.sizeMultiplier,
  };
}

function scoreStructure(htfTrend, entryDirection) {
  if (htfTrend === 'bull' && entryDirection === 'LONG')  return 1;
  if (htfTrend === 'bear' && entryDirection === 'SHORT') return 1;
  return 0;
}

function scoreTime(killzoneResult) {
  return killzoneResult.inKillzone ? 1 : 0;
}

function scorePrice(entryPrice, swingHigh, swingLow, entryDirection, oteCfg) {
  const range = swingHigh - swingLow;
  if (range === 0) return 0;
  const ret = entryDirection === 'LONG'
    ? (swingHigh - entryPrice) / range
    : (entryPrice - swingLow)  / range;

  if (ret >= oteCfg.start && ret <= oteCfg.end)               return 1;
  if (ret >= oteCfg.shallowStart && ret < oteCfg.start)       return 0.5;
  if (ret < oteCfg.shallowStart)                               return -1;
  return 0;
}

function scorePDArray(entryZone, activeFVGs, activeOBs, activeBBs) {
  const overlaps = (zone, poi) => zone.low <= poi.high && zone.high >= poi.low;
  let count = 0;
  for (const fvg of activeFVGs) if (overlaps(entryZone, fvg)) count++;
  for (const ob  of activeOBs)  if (overlaps(entryZone, ob))  count++;
  for (const bb  of activeBBs)  if (overlaps(entryZone, bb))  count++;
  if (count === 0) return 0;
  if (count === 1) return 1;
  return 2;
}

function scoreLiquidity(sweeps, entryTimeSecs, lookbackCandles) {
  const LTF_DURATION = 15 * 60;
  const lookbackSecs = lookbackCandles * LTF_DURATION;
  return sweeps.some(s => s.confirmed && s.time >= entryTimeSecs - lookbackSecs) ? 1 : 0;
}

function getScoreGrade(total, thresholds) {
  if (total >= thresholds.S) return 'S';
  if (total >= thresholds.A) return 'A';
  if (total >= thresholds.B) return 'B';
  if (total >= thresholds.C) return 'C';
  return 'X';
}

function classifyOTE(entryPrice, swingHigh, swingLow, direction, oteCfg) {
  const range = swingHigh - swingLow;
  if (range === 0) return 'PREMIUM';
  const ret = direction === 'LONG'
    ? (swingHigh - entryPrice) / range
    : (entryPrice - swingLow)  / range;

  if (ret >= oteCfg.start && ret <= oteCfg.end)         return 'OTE';
  if (ret >= oteCfg.shallowStart && ret < oteCfg.start) return 'SHALLOW';
  if (ret > oteCfg.end)                                  return 'DEEP';
  return 'PREMIUM';
}

function finalEntryDecision(tier, grade) {
  if (grade === 'X') return { action: 'BLOCK', sizeMultiplier: 0 };
  if (grade === 'C') return { action: 'SKIP',  sizeMultiplier: 0 };
  if (tier >= 4)     return { action: 'SKIP',  sizeMultiplier: 0 };

  if ((grade === 'S' || grade === 'A') && tier <= 3) return { action: 'ENTER', sizeMultiplier: 1.0 };
  if (grade === 'B' && tier <= 2) return { action: 'ENTER', sizeMultiplier: 0.5 };

  return { action: 'SKIP', sizeMultiplier: 0 };
}

module.exports = { calculateEntryScorecard };
