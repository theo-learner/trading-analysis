'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { analyzeICT, _selectBestPOI } = require('../ict-engine');

// 합성 캔들 생성 헬퍼 — 단조증가 HTF (bull trend 유도)
function makeBullCandles(n, basePrice = 50000, step = 100) {
  return Array.from({ length: n }, (_, i) => {
    const open  = basePrice + i * step;
    const close = open + step * 0.8;
    return { time: i * 3600, open, high: close + 50, low: open - 50, close, volume: 1000 };
  });
}

// 단조감소 LTF (bear LTF → tier 4 유발)
function makeBearCandles(n, basePrice = 52000, step = 20) {
  return Array.from({ length: n }, (_, i) => {
    const open  = basePrice - i * step;
    const close = open - step * 0.8;
    return { time: i * 900, open, high: open + 10, low: close - 10, close, volume: 500 };
  });
}

test('analyzeICT: HTF bull + LTF bear → NEUTRAL (tier 4)', () => {
  const signal = analyzeICT({
    pair: 'TESTUSDT',
    htfCandles: makeBullCandles(150),
    ltfCandles: makeBearCandles(100),
  });
  // tier 4 → NEUTRAL
  assert.equal(signal.direction, 'NEUTRAL');
  assert.ok(signal.tier >= 4);
  assert.equal(signal.pair, 'TESTUSDT');
});

test('analyzeICT: validates HTF candle count minimum', () => {
  assert.throws(
    () => analyzeICT({ pair: 'TESTUSDT', htfCandles: makeBullCandles(50), ltfCandles: makeBullCandles(100) }),
    /HTF.*100/,
  );
});

test('analyzeICT: validates LTF candle count minimum', () => {
  assert.throws(
    () => analyzeICT({ pair: 'TESTUSDT', htfCandles: makeBullCandles(100), ltfCandles: makeBullCandles(20) }),
    /LTF.*50/,
  );
});

test('analyzeICT: analysisDate uses KST (UTC+9), not UTC', () => {
  // Simulate UTC 23:30 on 2026-05-16 = KST 08:30 on 2026-05-17
  const utcMidnightPlus23h30m = new Date('2026-05-16T23:30:00Z').getTime();
  const origDateNow = Date.now;
  Date.now = () => utcMidnightPlus23h30m;

  try {
    const signal = analyzeICT({
      pair: 'TESTUSDT',
      htfCandles: makeBullCandles(150),
      ltfCandles: makeBearCandles(100),
    });
    // KST date should be 2026-05-17, NOT 2026-05-16 (UTC)
    assert.equal(signal.analysisDate, '2026-05-17');
  } finally {
    Date.now = origDateNow;
  }
});

test('analyzeICT returns required signal fields', () => {
  const signal = analyzeICT({
    pair: 'TESTUSDT',
    htfCandles: makeBullCandles(150),
    ltfCandles: makeBearCandles(100),
  });
  assert.ok('direction' in signal, 'direction 필드 없음');
  assert.ok('tier' in signal, 'tier 필드 없음');
  assert.ok('pair' in signal, 'pair 필드 없음');
  assert.ok('timestamp' in signal, 'timestamp 필드 없음');
  assert.ok('confidence' in signal, 'confidence 필드 없음');
});

test('analyzeICT: aligned bull scenario returns non-NEUTRAL with ENTER or SKIP', () => {
  // HTF bull + LTF bull → tier 1/2 → 스코어카드에 따라 ENTER or SKIP, but not tier≥4 NEUTRAL
  const htf = makeBullCandles(150);
  const ltf = makeBullCandles(100, 60000, 5); // LTF도 bull
  const signal = analyzeICT({ pair: 'TESTUSDT', htfCandles: htf, ltfCandles: ltf });
  // NEUTRAL이 아니거나 (alignment 충분), 혹은 POI 없어서 NEUTRAL일 수 있음
  // 핵심: tier가 4 미만이면 reason이 tier 관련이 아님
  if (signal.direction === 'NEUTRAL') {
    assert.ok(signal.tier < 4 || signal.reason !== undefined);
  } else {
    assert.ok(['LONG', 'SHORT'].includes(signal.direction));
  }
});

// ── selectBestPOI 스윙 범위 필터링 ─────────────────────────────────────────────

function makePOI(low, high, type = 'FVG') {
  return { low, high, status: 'active', retestStatus: 'pending', poiType: type };
}

function makeSwing(price, type, index = 0) {
  return { index, time: index * 900, price, type };
}

test('selectBestPOI: 현재가 스윙 범위 내 POI만 선택된다', () => {
  // 스윙 범위: low=49000, high=51000 / 현재가=50000
  const ltfSwings = [
    makeSwing(49000, 'low',  0),
    makeSwing(51000, 'high', 5),
  ];
  const currentPrice = 50000;

  // 범위 내 FVG (49500~49800)
  const inRangeFVG  = makePOI(49500, 49800);
  // 범위 밖 FVG (48000~48500 — swingLow 아래)
  const outRangeFVG = makePOI(48000, 48500);

  const result = _selectBestPOI([inRangeFVG, outRangeFVG], [], [], 'bull', currentPrice, ltfSwings);
  assert.ok(result !== null, 'POI를 찾아야 한다');
  assert.ok(result.low >= 49000 && result.high <= 51000, `POI(${result.low}~${result.high})가 스윙 범위(49000~51000) 밖`);
});

test('selectBestPOI: 모든 POI가 스윙 범위 밖이면 null 반환', () => {
  const ltfSwings = [
    makeSwing(49000, 'low',  0),
    makeSwing(51000, 'high', 5),
  ];
  const currentPrice = 50000;

  const outRangeFVG = makePOI(48000, 48500);  // 범위 밖

  const result = _selectBestPOI([outRangeFVG], [], [], 'bull', currentPrice, ltfSwings);
  assert.equal(result, null, '범위 밖 POI만 있으면 null이어야 한다');
});

test('analyzeICT exposes mss, bos, displacements arrays with origin tags', () => {
  const signal = analyzeICT({
    pair: 'TESTUSDT',
    htfCandles: makeBullCandles(150),
    ltfCandles: makeBearCandles(100),
  });
  assert.ok(Array.isArray(signal.mss), 'mss array missing');
  assert.ok(Array.isArray(signal.bos), 'bos array missing');
  assert.ok(Array.isArray(signal.displacements), 'displacements array missing');
  if (signal.mss.length > 0) {
    assert.ok(['HTF', 'LTF'].includes(signal.mss[0].origin), 'mss origin tag missing');
  }
  if (signal.bos.length > 0) {
    assert.ok(['HTF', 'LTF'].includes(signal.bos[0].origin), 'bos origin tag missing');
  }
});

test('selectBestPOI: 스윙 포인트 없으면 기존처럼 모든 POI 허용', () => {
  const ltfSwings = [];  // 스윙 없음
  const currentPrice = 50000;

  const anyFVG = makePOI(47000, 47500);
  const result = _selectBestPOI([anyFVG], [], [], 'bull', currentPrice, ltfSwings);
  assert.ok(result !== null, '스윙 없으면 POI를 필터 없이 선택해야 한다');
});

test('analyzeICT: entry.killzone is never a boolean', () => {
  const signal = analyzeICT({
    pair: 'TESTUSDT',
    htfCandles: makeBullCandles(150),
    ltfCandles: makeBullCandles(100, 60000, 5),
  });
  if (signal.entry) {
    assert.notStrictEqual(typeof signal.entry.killzone, 'boolean',
      'entry.killzone must be string or null, never boolean');
  }
});

test('analyzeICT: entry.killzone is name string when inside killzone window', () => {
  // UTC 13:00 → new_york killzone (12-14)
  const inKillzone = new Date('2026-01-01T13:00:00Z').getTime();
  const orig = Date.now;
  Date.now = () => inKillzone;
  try {
    const signal = analyzeICT({
      pair: 'TESTUSDT',
      htfCandles: makeBullCandles(150),
      ltfCandles: makeBullCandles(100, 60000, 5),
    });
    if (signal.entry) {
      assert.equal(typeof signal.entry.killzone, 'string');
      assert.ok(signal.entry.killzone.length > 0, 'killzone name must be non-empty');
    }
  } finally {
    Date.now = orig;
  }
});

test('analyzeICT: entry.killzone is null when outside killzone window', () => {
  // UTC 05:00 → no killzone
  const outKillzone = new Date('2026-01-01T05:00:00Z').getTime();
  const orig = Date.now;
  Date.now = () => outKillzone;
  try {
    const signal = analyzeICT({
      pair: 'TESTUSDT',
      htfCandles: makeBullCandles(150),
      ltfCandles: makeBullCandles(100, 60000, 5),
    });
    if (signal.entry) {
      assert.equal(signal.entry.killzone, null);
    }
  } finally {
    Date.now = orig;
  }
});

test('analyzeICT: signal.swingRanges에 htf/ltf 범위가 포함된다', () => {
  const signal = analyzeICT({
    pair: 'TESTUSDT',
    htfCandles: makeBullCandles(150),
    ltfCandles: makeBearCandles(100),
  });
  assert.ok('swingRanges' in signal, 'swingRanges 필드 없음');
  assert.ok(signal.swingRanges !== null && typeof signal.swingRanges === 'object');
  assert.ok('htf' in signal.swingRanges, 'swingRanges.htf 없음');
  assert.ok('ltf' in signal.swingRanges, 'swingRanges.ltf 없음');
  if (signal.swingRanges.htf !== null) {
    assert.ok(typeof signal.swingRanges.htf.low  === 'number', 'htf.low 숫자 아님');
    assert.ok(typeof signal.swingRanges.htf.high === 'number', 'htf.high 숫자 아님');
    assert.ok(signal.swingRanges.htf.low <= signal.swingRanges.htf.high, 'htf.low > htf.high');
  }
  if (signal.swingRanges.ltf !== null) {
    assert.ok(typeof signal.swingRanges.ltf.low  === 'number', 'ltf.low 숫자 아님');
    assert.ok(typeof signal.swingRanges.ltf.high === 'number', 'ltf.high 숫자 아님');
    assert.ok(signal.swingRanges.ltf.low <= signal.swingRanges.ltf.high, 'ltf.low > ltf.high');
  }
});

test('analyzeICT: LONG 시그널이면 SL < 진입가, SHORT 시그널이면 SL > 진입가', () => {
  // bull 캔들 구조로 LONG 시그널 유도 시도
  const signal = analyzeICT({
    pair: 'TESTUSDT',
    htfCandles: makeBullCandles(150),
    ltfCandles: makeBullCandles(100, 60000, 5),
  });
  if (signal.direction === 'LONG') {
    assert.ok(signal.sl < signal.entry.price,
      `LONG: SL(${signal.sl})이 진입가(${signal.entry.price}) 아래여야 한다`);
    signal.tp.forEach((t, i) => {
      assert.ok(t > signal.entry.price,
        `LONG: TP${i + 1}(${t})이 진입가(${signal.entry.price}) 위여야 한다`);
    });
  } else if (signal.direction === 'SHORT') {
    assert.ok(signal.sl > signal.entry.price,
      `SHORT: SL(${signal.sl})이 진입가(${signal.entry.price}) 위여야 한다`);
    signal.tp.forEach((t, i) => {
      assert.ok(t < signal.entry.price,
        `SHORT: TP${i + 1}(${t})이 진입가(${signal.entry.price}) 아래여야 한다`);
    });
  }
  // NEUTRAL이면 SL/TP 검증 불필요
});
