'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { detectAMDPhase } = require('../../modules/amd');

function makeCandle(i, range = 10) {
  const open = 100 + i;
  return { time: i * 900, open, high: open + range, low: open - range, close: open + range * 0.5, volume: 1 };
}

function makeSweep(index, type, confirmed = true) {
  // type: 'BSL' | 'SSL'
  return { index, type, confirmed, price: 100 + index };
}

function makeBOS(index, direction) {
  // direction: 'bull' | 'bear'
  return { index, time: index * 900, price: 100 + index, type: 'BOS', direction };
}

function makeSwing(index, type, price) {
  return { index, time: index * 900, price, type };
}

describe('detectAMDPhase — A→M→D→R sequence', () => {

  // ── ACCUMULATION ─────────────────────────────────────────────────────────────

  it('ACCUMULATION: no sweep, no BOS, range-bound', () => {
    const candles = Array.from({ length: 30 }, (_, i) => makeCandle(i, 5));
    const swings = [makeSwing(5, 'high', 108), makeSwing(10, 'low', 97), makeSwing(15, 'high', 109)];
    const result = detectAMDPhase(candles, swings, [], []);
    assert.equal(result, 'ACCUMULATION');
  });

  // ── MANIPULATION ─────────────────────────────────────────────────────────────

  it('MANIPULATION: recent confirmed sweep, no subsequent BOS', () => {
    const N = 30;
    const candles = Array.from({ length: N }, (_, i) => makeCandle(i));
    const swings = [makeSwing(5, 'high', 108), makeSwing(10, 'low', 97)];
    // sweep at index 25 (within last 10 of 30)
    const sweeps = [makeSweep(25, 'BSL')];
    const result = detectAMDPhase(candles, swings, sweeps, []);
    assert.equal(result, 'MANIPULATION');
  });

  it('MANIPULATION: BSL sweep present, BOS before sweep is ignored for M→D', () => {
    const N = 30;
    const candles = Array.from({ length: N }, (_, i) => makeCandle(i));
    const swings = [makeSwing(5, 'high', 108), makeSwing(10, 'low', 97)];
    // BOS at 15 (BEFORE sweep at 25) → sequence is not sweep→BOS, should still be MANIPULATION
    const sweeps = [makeSweep(25, 'BSL')];
    const bosEvents = [makeBOS(15, 'bull')];
    const result = detectAMDPhase(candles, swings, sweeps, bosEvents);
    assert.equal(result, 'MANIPULATION');
  });

  // ── DISTRIBUTION ─────────────────────────────────────────────────────────────

  it('DISTRIBUTION: SSL sweep then bull BOS after sweep (bear sweep → bull BOS = M→D)', () => {
    const N = 30;
    const candles = Array.from({ length: N }, (_, i) => makeCandle(i));
    const swings = [makeSwing(5, 'high', 108), makeSwing(10, 'low', 97)];
    // SSL sweep at 20, bull BOS at 25 (after sweep) → DISTRIBUTION
    const sweeps = [makeSweep(20, 'SSL')];
    const bosEvents = [makeBOS(25, 'bull')];
    const result = detectAMDPhase(candles, swings, sweeps, bosEvents);
    assert.equal(result, 'DISTRIBUTION');
  });

  it('DISTRIBUTION: BSL sweep then bear BOS after sweep (bull sweep → bear BOS = M→D)', () => {
    const N = 30;
    const candles = Array.from({ length: N }, (_, i) => makeCandle(i));
    const swings = [makeSwing(5, 'high', 108), makeSwing(10, 'low', 97)];
    // BSL sweep at 20, bear BOS at 26 (after sweep) → DISTRIBUTION
    const sweeps = [makeSweep(20, 'BSL')];
    const bosEvents = [makeBOS(26, 'bear')];
    const result = detectAMDPhase(candles, swings, sweeps, bosEvents);
    assert.equal(result, 'DISTRIBUTION');
  });

  it('DISTRIBUTION: SSL sweep → bear BOS (same direction) does NOT qualify (wrong directionality)', () => {
    // SSL sweep (bear) → bear BOS: same direction, not a reversal sweep sequence
    const N = 30;
    const candles = Array.from({ length: N }, (_, i) => makeCandle(i));
    const swings = [makeSwing(5, 'high', 108), makeSwing(10, 'low', 97)];
    const sweeps = [makeSweep(20, 'SSL')];
    const bosEvents = [makeBOS(26, 'bear')];  // same direction as sweep → not M→D
    const result = detectAMDPhase(candles, swings, sweeps, bosEvents);
    // Should NOT be DISTRIBUTION — SSL sweep then bear BOS is continuation, not reversal
    assert.notEqual(result, 'DISTRIBUTION');
  });

  // ── RESET ─────────────────────────────────────────────────────────────────────

  it('RESET: old sweep outside lookback window, no fresh sweep or BOS', () => {
    const N = 30;
    const candles = Array.from({ length: N }, (_, i) => makeCandle(i));
    const swings = [makeSwing(5, 'high', 150), makeSwing(20, 'low', 50)]; // wide range
    // sweep at index 5 — too old (lastIdx=29, 29-5=24 > 10)
    const sweeps = [makeSweep(5, 'BSL')];
    const result = detectAMDPhase(candles, swings, sweeps, []);
    assert.equal(result, 'RESET');
  });

  it('RESET: sweep→BOS sequence both outside lookback window', () => {
    const N = 50;
    const candles = Array.from({ length: N }, (_, i) => makeCandle(i));
    const swings = [makeSwing(5, 'high', 108), makeSwing(10, 'low', 97)];
    // sweep at 20, BOS at 25 — both far from lastIdx=49
    const sweeps = [makeSweep(20, 'BSL')];
    const bosEvents = [makeBOS(25, 'bear')];
    const result = detectAMDPhase(candles, swings, sweeps, bosEvents);
    assert.equal(result, 'RESET');
  });

  // ── EDGE CASES ────────────────────────────────────────────────────────────────

  it('returns UNKNOWN for empty candles or swings', () => {
    assert.equal(detectAMDPhase([], [], [], []), 'UNKNOWN');
    assert.equal(detectAMDPhase([makeCandle(0)], [], [], []), 'UNKNOWN');
  });

  it('handles null/undefined sweeps and bosEvents gracefully', () => {
    const candles = Array.from({ length: 20 }, (_, i) => makeCandle(i));
    const swings = [makeSwing(5, 'high', 108), makeSwing(10, 'low', 97)];
    assert.doesNotThrow(() => detectAMDPhase(candles, swings, null, null));
    assert.doesNotThrow(() => detectAMDPhase(candles, swings, undefined, undefined));
  });
});
