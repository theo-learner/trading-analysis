'use strict';
const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { detectFVG } = require('../../modules/fvg');

function makeCandle(time, open, high, low, close) {
  return { time, open, high, low, close, volume: 1 };
}

// Bull FVG 기준 캔들셋: candles[0..2] 로 bull FVG (low=105, high=107) 형성
// fvg.index = 1, 미티게이션 루프는 candles[3] 부터 시작
function makeBullFVGCandles(...extra) {
  return [
    makeCandle(0, 100, 105, 98,  103), // c1: high=105 → fvg.low
    makeCandle(1, 103, 108, 101, 106), // c2: middle
    makeCandle(2, 108, 115, 107, 113), // c3: low=107 → fvg.high  (gap: 105~107)
    ...extra,
  ];
}

// Bear FVG 기준 캔들셋: candles[0..2] 로 bear FVG (low=107, high=108) 형성
function makeBearFVGCandles(...extra) {
  return [
    makeCandle(0, 110, 115, 108, 112), // c1: low=108 → fvg.high
    makeCandle(1, 112, 113, 105, 108), // c2: middle
    makeCandle(2, 108, 107, 100, 103), // c3: high=107 → fvg.low  (gap: 107~108)
    ...extra,
  ];
}

describe('detectFVG — 기본 감지', () => {
  it('bull FVG 감지 (c3.low > c1.high)', () => {
    const fvgs = detectFVG(makeBullFVGCandles(), { minGapPct: 0.001 });
    assert.equal(fvgs.length, 1);
    assert.equal(fvgs[0].direction, 'bull');
    assert.equal(fvgs[0].high, 107);
    assert.equal(fvgs[0].low, 105);
    assert.equal(fvgs[0].status, 'active');
  });

  it('bear FVG 감지 (c1.low > c3.high)', () => {
    const fvgs = detectFVG(makeBearFVGCandles(), { minGapPct: 0.001 });
    assert.equal(fvgs.length, 1);
    assert.equal(fvgs[0].direction, 'bear');
    assert.equal(fvgs[0].high, 108);
    assert.equal(fvgs[0].low, 107);
    assert.equal(fvgs[0].status, 'active');
  });

  it('minGapPct 미만 갭은 무시', () => {
    const candles = [
      makeCandle(0, 100, 105.00, 98, 103),
      makeCandle(1, 103, 108,    101, 106),
      makeCandle(2, 108, 115,    105.01, 113), // gap ≈ 0.0001 < 0.001
    ];
    assert.equal(detectFVG(candles, { minGapPct: 0.001 }).length, 0);
  });

  it('FVG 없으면 빈 배열', () => {
    const candles = [
      makeCandle(0, 100, 110, 98, 105),
      makeCandle(1, 105, 108, 100, 104),
      makeCandle(2, 104, 107, 99, 103),
    ];
    assert.equal(detectFVG(candles, { minGapPct: 0.001 }).length, 0);
  });
});

describe('detectFVG — 미티게이션 (스펙 §6.3)', () => {

  // ── Bull FVG ──────────────────────────────────────────────────────────────────

  it('[bull] 갭 미접촉 캔들 → active 유지', () => {
    // close=115, high=120, low=110 — FVG [105,107] 에 접촉 없음
    const candles = makeBullFVGCandles(
      makeCandle(3, 113, 120, 110, 115),
    );
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs[0].status, 'active');
  });

  it('[bull] 갭 진입 but close가 fvg.low 위 → tested (부분 충전, 미완료)', () => {
    // 캔들이 FVG [105,107] 에 닿고 close=106 이 fvg.low=105 위
    const candles = makeBullFVGCandles(
      makeCandle(3, 113, 115, 104, 106), // low=104 < fvg.high=107 → touches; close=106 > fvg.low=105
    );
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs[0].status, 'tested');
  });

  it('[bull] close가 fvg.low 아래 → mitigated (완전 충전)', () => {
    // close=104 < fvg.low=105 → 반대편 돌파 → 완전 미티게이션
    const candles = makeBullFVGCandles(
      makeCandle(3, 113, 115, 103, 104), // low=103 touches; close=104 < fvg.low=105
    );
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs[0].status, 'mitigated');
  });

  it('[bull] tested 이후 캔들이 fvg.low 돌파 → mitigated 로 전환', () => {
    const candles = makeBullFVGCandles(
      makeCandle(3, 113, 115, 104, 106), // tested (close=106 안에)
      makeCandle(4, 106, 108, 102, 103), // close=103 < fvg.low=105 → mitigated
    );
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs[0].status, 'mitigated');
  });

  // ── Bear FVG ─────────────────────────────────────────────────────────────────

  it('[bear] 갭 미접촉 캔들 → active 유지', () => {
    // close=95, high=102, low=90 — FVG [107,108] 에 접촉 없음
    const candles = makeBearFVGCandles(
      makeCandle(3, 103, 102, 90, 95),
    );
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs[0].status, 'active');
  });

  it('[bear] 갭 진입 but close가 fvg.high 아래 → tested', () => {
    // 캔들이 FVG [107,108] 에 닿고 close=107.5 이 fvg.high=108 아래
    const candles = makeBearFVGCandles(
      makeCandle(3, 103, 109, 106, 107.5), // high=109 > fvg.low=107 → touches; close=107.5 < fvg.high=108
    );
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs[0].status, 'tested');
  });

  it('[bear] close가 fvg.high 위 → mitigated (완전 충전)', () => {
    // close=109 > fvg.high=108 → 반대편 돌파 → 완전 미티게이션
    const candles = makeBearFVGCandles(
      makeCandle(3, 103, 110, 106, 109), // high=110 touches; close=109 > fvg.high=108
    );
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs[0].status, 'mitigated');
  });

  it('[bear] tested 이후 캔들이 fvg.high 돌파 → mitigated 로 전환', () => {
    const candles = makeBearFVGCandles(
      makeCandle(3, 103, 109, 106, 107.5), // tested
      makeCandle(4, 107.5, 110, 107, 109), // close=109 > fvg.high=108 → mitigated
    );
    const fvgs = detectFVG(candles, { minGapPct: 0.001 });
    assert.equal(fvgs[0].status, 'mitigated');
  });
});
