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
});
