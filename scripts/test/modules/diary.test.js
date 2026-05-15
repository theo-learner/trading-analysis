'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const path   = require('node:path');
const { buildDiary } = require('../../modules/diary');

const FIXTURES = path.join(__dirname, 'fixtures');
const fullSignal    = require(path.join(FIXTURES, 'diary-full-enter.json'));
const neutralSignal = require(path.join(FIXTURES, 'diary-neutral.json'));
const partialSignal = require(path.join(FIXTURES, 'diary-partial.json'));

describe('buildDiary', () => {
  it('generates 6-step markdown for full ENTER signal', () => {
    const md = buildDiary(fullSignal);
    assert.match(md, /## 1단계 · 차트 선정/);
    assert.match(md, /## 6단계 · 스토리텔링/);
    assert.match(md, /BTCUSDT/);
    assert.match(md, /HTF: 4H/);
    assert.match(md, /LTF: 15M/);
  });

  it('includes frontmatter header with pair/direction/grade', () => {
    const md = buildDiary(fullSignal);
    assert.match(md, /# 구조 다이어리 — BTCUSDT/);
    assert.match(md, /진입 등급/);
  });

  it('includes advanced sections when Unicorn detected', () => {
    const md = buildDiary(fullSignal);
    assert.match(md, /심화 3 · Breaker Block/);
    assert.match(md, /유니콘 셋업 감지/);
  });

  it('omits advanced sections for NEUTRAL signal', () => {
    const md = buildDiary(neutralSignal);
    assert.match(md, /진입 등급.*SKIP/s);
    assert.match(md, /심화 단계 생략/);
    assert.doesNotMatch(md, /심화 1 · 딜링 레인지/);
  });

  it('NEUTRAL signal still includes 6 steps', () => {
    const md = buildDiary(neutralSignal);
    assert.match(md, /## 1단계 · 차트 선정/);
    assert.match(md, /## 6단계 · 스토리텔링/);
  });

  it('detects Unicorn setup when BB overlaps active FVG', () => {
    const result = buildDiary(fullSignal, { returnStruct: true });
    assert.strictEqual(result.unicorn.detected, true);
  });

  it('does not detect Unicorn when BB is absent', () => {
    const result = buildDiary(partialSignal, { returnStruct: true });
    assert.strictEqual(result.unicorn.detected, false);
  });

  it('grades FVG as A+ when in OTE zone and adjacent to MSS', () => {
    const result = buildDiary(fullSignal, { returnStruct: true });
    assert.ok(result.fvgs.some(f => f.grade === 'A+'), 'Expected at least one A+ FVG');
  });

  it('includes displacement info in step 4', () => {
    const md = buildDiary(fullSignal);
    assert.match(md, /Displacement/);
  });

  it('includes MSS info in step 5', () => {
    const md = buildDiary(fullSignal);
    assert.match(md, /MSS/);
  });

  it('step 4 filters out FVGs outside swing range', () => {
    const signalWithManyFVGs = {
      ...fullSignal,
      currentPrice: 103247.5,
      direction: 'LONG',
      levels: {
        ...fullSignal.levels,
        fvgs: [
          { low: 101000, high: 101500, direction: 'bull', status: 'active', time: 1747300000 }, // below SSL 102840 → out
          { low: 103020, high: 103180, direction: 'bull', status: 'active', time: 1747317600 }, // in range → keep
          { low: 103200, high: 103350, direction: 'bull', status: 'active', time: 1747318000 }, // in range → keep
          { low: 104000, high: 104500, direction: 'bull', status: 'active', time: 1747319000 }, // above BSL 103510 → out
        ],
        sweeps: [
          { type: 'SSL', price: 102840, time: 1747316100, confirmed: true,  origin: 'LTF' },
          { type: 'BSL', price: 103510, time: 1747308600, confirmed: false, origin: 'LTF' },
        ],
      },
    };
    const md = buildDiary(signalWithManyFVGs);
    assert.match(md,    /\$103,020/);   // in-range FVG appears
    assert.match(md,    /\$103,200/);   // in-range FVG appears
    assert.doesNotMatch(md, /\$101,000/); // out-of-range FVG omitted
    assert.doesNotMatch(md, /\$104,000/); // out-of-range FVG omitted
  });

  it('step 4 shows only the most recent displacement', () => {
    const signalWithManyDisps = {
      ...fullSignal,
      displacements: [
        { time: 1747300000, direction: 'bull', bodyPct: '1.20' },
        { time: 1747310000, direction: 'bull', bodyPct: '1.50' },
        { time: 1747320000, direction: 'bull', bodyPct: '0.95' }, // most recent
      ],
    };
    const md = buildDiary(signalWithManyDisps);
    const step4 = md.split('## 4단계')[1].split('## 5단계')[0];
    const dispMatches = [...step4.matchAll(/Displacement 캔들/g)];
    assert.strictEqual(dispMatches.length, 1, 'Only one displacement should appear');
  });
});
