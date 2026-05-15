'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateAlignmentScore } = require('../../modules/alignment');

function makeAnalysis(trend, bosCount = 1, hasBOSinDir = false, opts = {}) {
  return {
    trend,
    bos: Array.from({ length: bosCount }, (_, i) => ({ index: i, direction: trend })),
    mss: [],
    priceInHTF_OB:  opts.inOB  || false,
    priceInHTF_FVG: opts.inFVG || false,
    priceInHTF_BB:  opts.inBB  || false,
    hasRecentBOS_in_htfDir: hasBOSinDir,
  };
}

test('HTF bull + LTF bull + LTF BOS in htf dir → tier 1', () => {
  const htf = makeAnalysis('bull', 1);
  const ltf = makeAnalysis('bull', 0, true); // hasRecentBOS_in_htfDir=true
  const result = calculateAlignmentScore(htf, ltf);
  assert.equal(result.tier, 1);
  assert.ok(result.score > 60);
});

test('HTF bull + LTF bull, no BOS in dir → tier 2', () => {
  const htf = makeAnalysis('bull', 1);
  const ltf = makeAnalysis('bull', 0, false);
  const result = calculateAlignmentScore(htf, ltf);
  assert.equal(result.tier, 2);
});

test('HTF bull + LTF ranging → tier 3', () => {
  const htf = makeAnalysis('bull', 1);
  const ltf = makeAnalysis('ranging', 0);
  const result = calculateAlignmentScore(htf, ltf);
  assert.equal(result.tier, 3);
});

test('HTF bull + LTF bear → tier 4', () => {
  const htf = makeAnalysis('bull', 1);
  const ltf = makeAnalysis('bear', 0);
  const result = calculateAlignmentScore(htf, ltf);
  assert.equal(result.tier, 4);
});

test('HTF ranging → tier 5', () => {
  const htf = makeAnalysis('ranging', 0);
  const ltf = makeAnalysis('bull', 0);
  const result = calculateAlignmentScore(htf, ltf);
  assert.equal(result.tier, 5);
});

test('POI confluence adds to score', () => {
  const htf = makeAnalysis('bull', 1);
  const ltfNoPOI  = makeAnalysis('bull', 0, true);
  const ltfWithPOI = { ...makeAnalysis('bull', 0, true), priceInHTF_OB: true, priceInHTF_FVG: true };
  const base  = calculateAlignmentScore(htf, ltfNoPOI);
  const withPOI = calculateAlignmentScore(htf, ltfWithPOI);
  assert.ok(withPOI.score > base.score);
});

test('isAligned true for tier 1 and 2', () => {
  const htf = makeAnalysis('bull', 1);
  const ltf = makeAnalysis('bull', 0, false);
  const result = calculateAlignmentScore(htf, ltf);
  assert.equal(result.isAligned, true);
});

test('canTrade false for tier 4', () => {
  const htf = makeAnalysis('bull', 1);
  const ltf = makeAnalysis('bear', 0);
  const result = calculateAlignmentScore(htf, ltf);
  assert.equal(result.canTrade, false);
});
