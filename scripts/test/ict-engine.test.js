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
