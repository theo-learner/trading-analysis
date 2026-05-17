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

  it('step 3 filters out sweeps outside swing range', () => {
    // LONG: getSwingRange uses the LAST confirmed SSL as low and FIRST pending BSL as high.
    // Put the older confirmed SSL first so it's NOT the last → becomes out-of-range (below low).
    const sig = {
      ...fullSignal,
      currentPrice: 103247.5,
      direction: 'LONG',
      levels: {
        ...fullSignal.levels,
        sweeps: [
          { type: 'SSL', price: 100000, time: 1747300000, confirmed: true,  origin: 'LTF' }, // older confirmed SSL → below low (102840) → OUT
          { type: 'SSL', price: 102840, time: 1747316100, confirmed: true,  origin: 'LTF' }, // LAST confirmed SSL → low=102840 (boundary, in range)
          { type: 'BSL', price: 103510, time: 1747308600, confirmed: false, origin: 'LTF' }, // FIRST pending BSL → high=103510 (boundary, in range)
          { type: 'BSL', price: 110000, time: 1747320000, confirmed: false, origin: 'LTF' }, // above high → OUT
        ],
      },
    };
    const md = buildDiary(sig);
    const step3 = md.split('## 3단계')[1].split('## 4단계')[0];
    assert.match(step3,    /\$102,840/);
    assert.match(step3,    /\$103,510/);
    assert.doesNotMatch(step3, /\$100,000/);
    assert.doesNotMatch(step3, /\$110,000/);
  });

  it('step 3 shows omitted suffix when sweeps exceed top-3 or are out of range', () => {
    // Same fixture: 2 in-range, 2 out-of-range → omitted = 4 - 2 = 2
    const sig = {
      ...fullSignal,
      currentPrice: 103247.5,
      direction: 'LONG',
      levels: {
        ...fullSignal.levels,
        sweeps: [
          { type: 'SSL', price: 100000, time: 1747300000, confirmed: true,  origin: 'LTF' }, // out of range
          { type: 'SSL', price: 102840, time: 1747316100, confirmed: true,  origin: 'LTF' }, // in range (low boundary)
          { type: 'BSL', price: 103510, time: 1747308600, confirmed: false, origin: 'LTF' }, // in range (high boundary)
          { type: 'BSL', price: 110000, time: 1747320000, confirmed: false, origin: 'LTF' }, // out of range
        ],
      },
    };
    const md = buildDiary(sig);
    const step3 = md.split('## 3단계')[1].split('## 4단계')[0];
    assert.match(step3, /\*\(외 2개 범위 외 생략\)\*/);
  });

  it('step 3 omits suffix when all in-range sweeps fit within top-3', () => {
    const sig = {
      ...fullSignal,
      currentPrice: 103247.5,
      direction: 'LONG',
      levels: {
        ...fullSignal.levels,
        sweeps: [
          { type: 'SSL', price: 102840, time: 1747316100, confirmed: true,  origin: 'LTF' },
          { type: 'BSL', price: 103510, time: 1747308600, confirmed: false, origin: 'LTF' },
        ],
      },
    };
    const md = buildDiary(sig);
    const step3 = md.split('## 3단계')[1].split('## 4단계')[0];
    assert.doesNotMatch(step3, /범위 외 생략/);
  });

  it('step 3 shows 없음 when all sweeps lie outside fallback swing range (NEUTRAL)', () => {
    const sig = {
      ...neutralSignal,
      direction: 'NEUTRAL',
      currentPrice: 103247.5,
      // NEUTRAL fallback range: cp*0.97 ~ cp*1.03 = ~100,150 ~ 106,345
      levels: {
        ...neutralSignal.levels,
        sweeps: [
          { type: 'SSL', price: 50000,  time: 1747300000, confirmed: true,  origin: 'LTF' },
          { type: 'BSL', price: 200000, time: 1747320000, confirmed: false, origin: 'LTF' },
        ],
      },
    };
    const md = buildDiary(sig);
    const step3 = md.split('## 3단계')[1].split('## 4단계')[0];
    assert.match(step3, /없음/);
    assert.match(step3, /스윙 범위/);
  });

  // ── Step 5 tests ─────────────────────────────────────────────────────────────

  it('step 5 filters MSS outside swing range (LONG)', () => {
    // LONG: range = [102840, 103510] (SSL@102840 confirmed, BSL@103510 pending)
    const sig = {
      ...fullSignal,
      currentPrice: 103247.5,
      direction: 'LONG',
      levels: {
        ...fullSignal.levels,
        sweeps: [
          { type: 'SSL', price: 102840, time: 1747316100, confirmed: true,  origin: 'LTF' },
          { type: 'BSL', price: 103510, time: 1747308600, confirmed: false, origin: 'LTF' },
        ],
      },
      mss: [
        { direction: 'bull', time: 1747317300, price: 103180, origin: 'LTF' }, // in range
        { direction: 'bull', time: 1747317000, price: 103050, origin: 'LTF' }, // in range
        { direction: 'bull', time: 1747200000, price: 75425,  origin: 'HTF' }, // below low → out
        { direction: 'bear', time: 1747320000, price: 110000, origin: 'HTF' }, // above high → out
      ],
    };
    const md = buildDiary(sig);
    const step5 = md.split('## 5단계')[1].split('## 6단계')[0];
    assert.match(step5,    /\$103,180/);
    assert.match(step5,    /\$103,050/);
    assert.doesNotMatch(step5, /\$75,425/);
    assert.doesNotMatch(step5, /\$110,000/);
  });

  it('step 5 MSS shows omitted suffix when out-of-range items exist', () => {
    const sig = {
      ...fullSignal,
      currentPrice: 103247.5,
      direction: 'LONG',
      levels: {
        ...fullSignal.levels,
        sweeps: [
          { type: 'SSL', price: 102840, time: 1747316100, confirmed: true,  origin: 'LTF' },
          { type: 'BSL', price: 103510, time: 1747308600, confirmed: false, origin: 'LTF' },
        ],
      },
      mss: [
        { direction: 'bull', time: 1747317300, price: 103180, origin: 'LTF' }, // in range
        { direction: 'bull', time: 1747317000, price: 103050, origin: 'LTF' }, // in range
        { direction: 'bull', time: 1747200000, price: 75425,  origin: 'HTF' }, // out
        { direction: 'bear', time: 1747320000, price: 110000, origin: 'HTF' }, // out
      ],
    };
    const md = buildDiary(sig);
    const step5 = md.split('## 5단계')[1].split('## 6단계')[0];
    assert.match(step5, /\*\(외 2개 범위 외 생략\)\*/);
  });

  it('step 5 BOS shows omitted suffix when out-of-range items exist', () => {
    const sig = {
      ...fullSignal,
      currentPrice: 103247.5,
      direction: 'LONG',
      levels: {
        ...fullSignal.levels,
        sweeps: [
          { type: 'SSL', price: 102840, time: 1747316100, confirmed: true,  origin: 'LTF' },
          { type: 'BSL', price: 103510, time: 1747308600, confirmed: false, origin: 'LTF' },
        ],
      },
      mss: [
        { direction: 'bull', time: 1747317300, price: 103180, origin: 'LTF' }, // in range only
      ],
      bos: [
        { direction: 'bull', time: 1747317000, price: 103050, origin: 'LTF' }, // in range
        { direction: 'bull', time: 1747200000, price: 75425,  origin: 'HTF' }, // out
        { direction: 'bull', time: 1747190000, price: 74000,  origin: 'HTF' }, // out
        { direction: 'bull', time: 1747180000, price: 73000,  origin: 'HTF' }, // out
      ],
    };
    const md = buildDiary(sig);
    const step5 = md.split('## 5단계')[1].split('## 6단계')[0];
    assert.match(step5, /\*\(외 3개 범위 외 생략\)\*/);
  });

  it('step 5 shows 없음 when all MSS lie outside NEUTRAL fallback swing range', () => {
    // NEUTRAL fallback: cp*0.97 ~ cp*1.03 = ~100,150 ~ 106,345
    const sig = {
      ...neutralSignal,
      direction: 'NEUTRAL',
      currentPrice: 103247.5,
      levels: {
        ...neutralSignal.levels,
        sweeps: [],
      },
      mss: [
        { direction: 'bull', time: 1747200000, price: 50000,  origin: 'HTF' },
        { direction: 'bull', time: 1747100000, price: 200000, origin: 'HTF' },
      ],
      bos: [],
    };
    const md = buildDiary(sig);
    const step5 = md.split('## 5단계')[1].split('## 6단계')[0];
    assert.match(step5, /최근 100봉 내 없음/);
    assert.match(step5, /스윙 범위/);
    assert.match(step5, /밖/);
  });

  it('includes HTF/LTF swing range lines in header when swingRanges present', () => {
    const sig = {
      ...fullSignal,
      swingRanges: {
        htf: { low: 94500, high: 108200, count: 4 },
        ltf: { low: 102300, high: 107800, count: 4 },
      },
    };
    const md = buildDiary(sig);
    const header = md.split('## 1단계')[0];
    assert.match(header, /스윙 범위 \(HTF 4H\)/);
    assert.match(header, /\$94,500.*\$108,200/);
    assert.match(header, /스윙 범위 \(LTF 15M\)/);
    assert.match(header, /\$102,300.*\$107,800/);
  });

  it('shows 데이터 부족 when swingRanges.htf is null', () => {
    const sig = {
      ...fullSignal,
      swingRanges: {
        htf: null,
        ltf: { low: 102300, high: 107800, count: 3 },
      },
    };
    const md = buildDiary(sig);
    const header = md.split('## 1단계')[0];
    assert.match(header, /스윙 범위 \(HTF 4H\).*데이터 부족/);
    assert.match(header, /스윙 범위 \(LTF 15M\)/);
  });

  it('omits swing range lines when swingRanges field is absent (legacy compat)', () => {
    const sig = { ...fullSignal };
    delete sig.swingRanges;
    const md = buildDiary(sig);
    const header = md.split('## 1단계')[0];
    assert.doesNotMatch(header, /스윙 범위 \(HTF 4H\)/);
    assert.doesNotMatch(header, /스윙 범위 \(LTF 15M\)/);
  });
});
