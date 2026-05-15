'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateEntryScorecard } = require('../../modules/scorecard');

const cfg = {
  scorecard: {
    ote: { start: 0.62, end: 0.79, shallowStart: 0.50 },
    liquidity: { lookbackCandles: 20 },
    gradeThresholds: { S: 5, A: 3, B: 2, C: 0 },
  },
};

const swingHigh = 110;
const swingLow  = 90;

// OTE LONG: retracement = (swingHigh - entryPrice) / range
// ret=0.70 → entryPrice = 110 - 0.70*20 = 96
const oteEntry = 96;

// PREMIUM LONG: ret=(110-108)/20=0.10 < 0.50 → S3=-1
const premiumEntry = 108;

function makeParams(entryPrice, kilzoneIn, sweeps, overlapping, tier) {
  return {
    htfTrend: 'bull',
    entryDirection: 'LONG',
    killzoneResult: { inKillzone: kilzoneIn, name: kilzoneIn ? 'new_york' : null },
    entryPrice,
    swingHigh,
    swingLow,
    entryZone: { high: entryPrice + 1, low: entryPrice - 1 },
    activeFVGs: overlapping.fvg ? [{ high: entryPrice + 2, low: entryPrice - 2, status: 'active' }] : [],
    activeOBs:  overlapping.ob  ? [{ high: entryPrice + 2, low: entryPrice - 2, status: 'active' }] : [],
    activeBBs:  overlapping.bb  ? [{ high: entryPrice + 2, low: entryPrice - 2, retestStatus: 'pending' }] : [],
    sweeps,
    entryTimeSecs: 1715000000,
    tier,
    cfg,
  };
}

test('spec §14.5 함정 패턴: total=0, grade=C, action=SKIP', () => {
  // S1=1(bull LONG), S2=0(no killzone), S3=-1(premium), S4=0(no overlap), S5=0(no sweep)
  const params = makeParams(premiumEntry, false, [], {}, 2);
  const sc = calculateEntryScorecard(params);
  assert.equal(sc.total, 0);
  assert.equal(sc.grade, 'C');
  assert.equal(sc.action, 'SKIP');
});

test('spec §14.5 S급 타점: total=6, grade=S, action=ENTER', () => {
  // S1=1, S2=1(NY killzone), S3=1(OTE), S4=2(OB+FVG), S5=1(recent sweep)
  const recentSweep = { confirmed: true, index: 10, time: 1714999000, type: 'BSL' };
  const params = makeParams(oteEntry, true, [recentSweep], { fvg: true, ob: true }, 1);
  const sc = calculateEntryScorecard(params);
  assert.equal(sc.total, 6);
  assert.equal(sc.grade, 'S');
  assert.equal(sc.action, 'ENTER');
  assert.equal(sc.sizeMultiplier, 1.0);
});

test('프리미엄 구간 LONG + tier4 → SKIP', () => {
  const paramsT4 = makeParams(premiumEntry, false, [], {}, 4);
  const sc = calculateEntryScorecard(paramsT4);
  assert.equal(sc.action, 'SKIP');
});

test('grade=B, tier=1 → ENTER with sizeMultiplier=0.5', () => {
  // S1=1, S2=0, S3=0.5(shallow ret=0.55→price=99), S4=1(fvg), S5=0 → total=2.5
  // Wait: total=1+0+0.5+1+0=2.5 → grade thresholds: B=2 → grade=B since 2.5>=2 but <3(A)
  // Actually: shallow gives 0.5 → total=2.5 → A threshold=3: 2.5<3 → B
  // shallow: ret=(110-99)/20=0.55 which is >=0.50 and <0.62 → SHALLOW → S3=0.5
  // total=1+0+0.5+1+0=2.5 → grade=B (>=2, <3)
  const params = makeParams(99, false, [], { fvg: true }, 1);
  const sc = calculateEntryScorecard(params);
  assert.equal(sc.grade, 'B');
  assert.equal(sc.action, 'ENTER');
  assert.equal(sc.sizeMultiplier, 0.5);
});

test('oteZone classification: OTE/SHALLOW/PREMIUM/DEEP', () => {
  const baseParams = (price) => makeParams(price, false, [], {}, 2);
  // OTE: ret=0.70 → price=96
  assert.equal(calculateEntryScorecard(baseParams(96)).oteZone, 'OTE');
  // SHALLOW: ret=0.55 → price=99
  assert.equal(calculateEntryScorecard(baseParams(99)).oteZone, 'SHALLOW');
  // PREMIUM: ret=0.10 → price=108
  assert.equal(calculateEntryScorecard(baseParams(108)).oteZone, 'PREMIUM');
  // DEEP: ret=0.85 → price=93
  assert.equal(calculateEntryScorecard(baseParams(93)).oteZone, 'DEEP');
});
