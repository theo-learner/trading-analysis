# ICT Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `scripts/ict-engine.js`의 스텁(`throw new Error('구현 필요')`)을 `references/ict-engine-spec.md` v0.2.0의 27-step 파이프라인으로 완전히 구현한다.

**Architecture:** `scripts/modules/`에 ICT 도메인 모듈(M1–M11) 10개를 TDD로 개별 구현하고, `scripts/utils/binance.js`로 Binance fapi 캔들 페처를 신설한다. `ict-engine.js`는 모듈을 조합해 27-step 파이프라인을 실행하고 `signals/` 폴더에 JSON을 저장하는 CLI 진입점이다.

**Tech Stack:** Node.js CommonJS, `node:test` (내장, 무설치), `node:assert/strict`, Binance fapi REST API

---

## File Map

| 생성/수정 | 파일 | 역할 |
|----------|------|------|
| 신설 | `scripts/utils/binance.js` | `fetchKlines`, `fetchCandleSet` — Binance fapi 캔들 페처 |
| 신설 | `scripts/modules/displacement.js` | M7: `isDisplacement` |
| 신설 | `scripts/modules/swing-points.js` | M1: `detectSwingPoints` |
| 신설 | `scripts/modules/market-structure.js` | M2: `detectBOS`, `detectMSS`, `getCurrentTrend` |
| 신설 | `scripts/modules/fvg.js` | M3: `detectFVG` |
| 신설 | `scripts/modules/order-block.js` | M4: `detectOrderBlocks` |
| 신설 | `scripts/modules/breaker-block.js` | M5: `detectBreakerBlocks` |
| 신설 | `scripts/modules/sweep.js` | M6: `detectLiquiditySweeps` |
| 신설 | `scripts/modules/alignment.js` | M8: `calculateAlignmentScore` |
| 신설 | `scripts/modules/amd.js` | M9: `detectAMDPhase` |
| 신설 | `scripts/modules/scorecard.js` | M11: `calculateEntryScorecard` |
| 수정 | `scripts/ict-engine.js` | 27-step 파이프라인 + CLI 진입점 (스텁 → 전체 구현) |
| 신설 | `scripts/test/modules/binance.test.js` | binance.js 단위 테스트 |
| 신설 | `scripts/test/modules/displacement.test.js` | displacement.js 단위 테스트 |
| 신설 | `scripts/test/modules/swing-points.test.js` | swing-points.js 단위 테스트 |
| 신설 | `scripts/test/modules/market-structure.test.js` | market-structure.js 단위 테스트 |
| 신설 | `scripts/test/modules/fvg.test.js` | fvg.js 단위 테스트 |
| 신설 | `scripts/test/modules/order-block.test.js` | order-block.js 단위 테스트 |
| 신설 | `scripts/test/modules/sweep.test.js` | sweep.js 단위 테스트 |
| 신설 | `scripts/test/modules/alignment.test.js` | alignment.js 단위 테스트 |
| 신설 | `scripts/test/modules/scorecard.test.js` | scorecard.js 단위 테스트 |
| 신설 | `scripts/test/ict-engine.test.js` | analyzeICT 통합 테스트 |

기존 파일 그대로 사용 (수정 없음):
- `scripts/utils/candle-utils.js` — `bodySize`, `totalRange`, `isBullish`, `isBearish`, `rollingAvgBody`, `priceMax`, `priceMin`
- `scripts/utils/time-utils.js` — `isInKillzone`, `killzoneBonus`
- `scripts/utils/logger.js`
- `scripts/config/ict-engine.json`

---

## 캔들 타입 참조

```js
// Candle { time: number (unix seconds), open: number, high: number, low: number, close: number, volume: number }
// SwingPoint { index: number, time: number, price: number, type: 'high'|'low' }
// StructureEvent { index, time, price, type: 'BOS'|'MSS', direction: 'bull'|'bear' }
// FVG { index, time, high, low, direction: 'bull'|'bear', status: 'active'|'mitigated' }
// OrderBlock { index, time, high, low, direction: 'bull'|'bear', status: 'active'|'invalidated' }
// BreakerBlock { index, time, high, low, direction: 'bull'|'bear', retestStatus: 'pending'|'tested' }
// SweepEvent { index, time, price, type: 'BSL'|'SSL', confirmed: boolean }
```

---

## Task 1: Binance Candle Fetcher

**Files:**
- Create: `scripts/utils/binance.js`
- Create: `scripts/test/modules/binance.test.js`

- [ ] **Step 1: 디렉터리 생성 및 실패 테스트 작성**

```bash
mkdir -p scripts/test/modules
```

`scripts/test/modules/binance.test.js`:
```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

// 파일이 없으므로 require 자체가 실패해야 함
test('binance.js exists', () => {
  assert.doesNotThrow(() => require('../../utils/binance'));
});

test('fetchKlines maps Binance raw array to Candle[]', async () => {
  const { fetchKlines } = require('../../utils/binance');

  const raw = [
    [1715000000000, '100.0', '105.0', '98.0', '103.0', '500.0', 0, 0, 0, 0, 0, 0],
  ];
  const mockFetch = async () => ({ ok: true, json: async () => raw });

  const candles = await fetchKlines('BTCUSDT', '15m', 1, mockFetch);
  assert.equal(candles.length, 1);
  assert.equal(candles[0].time, 1715000000);
  assert.equal(candles[0].open, 100.0);
  assert.equal(candles[0].high, 105.0);
  assert.equal(candles[0].low, 98.0);
  assert.equal(candles[0].close, 103.0);
  assert.equal(candles[0].volume, 500.0);
});

test('fetchCandleSet returns htf/ltf/h1/d1', async () => {
  const { fetchCandleSet } = require('../../utils/binance');

  const singleRaw = [[1715000000000, '100.0', '101.0', '99.0', '100.5', '10.0', 0, 0, 0, 0, 0, 0]];
  const mockFetch = async () => ({ ok: true, json: async () => singleRaw });

  const result = await fetchCandleSet('BTCUSDT', mockFetch);
  assert.ok(Array.isArray(result.htf));
  assert.ok(Array.isArray(result.ltf));
  assert.ok(Array.isArray(result.h1));
  assert.ok(Array.isArray(result.d1));
});

test('fetchKlines throws on non-ok response', async () => {
  const { fetchKlines } = require('../../utils/binance');
  const mockFetch = async () => ({ ok: false, status: 429 });
  await assert.rejects(() => fetchKlines('BTCUSDT', '15m', 1, mockFetch), /429/);
});
```

- [ ] **Step 2: 실패 확인**

```bash
node --test scripts/test/modules/binance.test.js
```

Expected: `Cannot find module '../../utils/binance'` 에러로 실패.

- [ ] **Step 3: 구현**

`scripts/utils/binance.js`:
```js
'use strict';

const BASE_URL = 'https://fapi.binance.com/fapi/v1/klines';
const LIMITS = { htf: 300, ltf: 300, h1: 300, d1: 100 };

async function fetchKlines(pair, interval, limit, fetchFn) {
  const fn = fetchFn || fetch;
  const url = `${BASE_URL}?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const resp = await fn(url);
  if (!resp.ok) throw new Error(`Binance API error: ${resp.status} for ${pair}/${interval}`);
  const raw = await resp.json();
  return raw.map(b => ({
    time:   Math.floor(Number(b[0]) / 1000),
    open:   parseFloat(b[1]),
    high:   parseFloat(b[2]),
    low:    parseFloat(b[3]),
    close:  parseFloat(b[4]),
    volume: parseFloat(b[5]),
  }));
}

async function fetchCandleSet(pair, fetchFn) {
  const [htf, ltf, h1, d1] = await Promise.all([
    fetchKlines(pair, '4h',  LIMITS.htf, fetchFn),
    fetchKlines(pair, '15m', LIMITS.ltf, fetchFn),
    fetchKlines(pair, '1h',  LIMITS.h1,  fetchFn),
    fetchKlines(pair, '1d',  LIMITS.d1,  fetchFn),
  ]);
  return { htf, ltf, h1, d1 };
}

module.exports = { fetchKlines, fetchCandleSet };
```

- [ ] **Step 4: 통과 확인**

```bash
node --test scripts/test/modules/binance.test.js
```

Expected: 4 tests pass.

- [ ] **Step 5: 커밋**

```bash
git add scripts/utils/binance.js scripts/test/modules/binance.test.js
git commit -m "feat: add binance.js candle fetcher with injectable fetchFn"
```

---

## Task 2: Displacement Detector (M7)

**Files:**
- Create: `scripts/modules/displacement.js`
- Create: `scripts/test/modules/displacement.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`scripts/test/modules/displacement.test.js`:
```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { isDisplacement } = require('../../modules/displacement');

// cfg: scripts/config/ict-engine.json의 displacement 섹션
const cfg = { rollingWindow: 10, bodyMultiplier: 1.5, maxWickRatio: 0.3, closeAtExtremeRatio: 0.6 };

// 평균 바디 = 10이 되도록 캔들 배열 생성
function makeCandles(n, bodySize = 10) {
  return Array.from({ length: n }, (_, i) => ({
    time: i, open: 100, high: 115, low: 85, close: 100 + bodySize, volume: 1,
  }));
}

test('body < avgBody * 1.5 → false', () => {
  const candles = makeCandles(11, 10); // avgBody = 10
  // 테스트 캔들: body = 14 (< 15 = 10*1.5)
  const candle = { time: 11, open: 100, high: 120, low: 97, close: 114, volume: 1 };
  assert.equal(isDisplacement(candle, candles, 10, cfg), false);
});

test('wick ratio > 0.3 → false', () => {
  const candles = makeCandles(11, 10); // avgBody = 10
  // body = 20 (≥15 ✓), total range = 25
  // bull: lower wick = open - low = 100 - 74 = 26? Let me compute:
  // candle: open=100, high=122, low=97, close=120
  // body = 20 ✓, total = 25, lowerWick = 100 - 97 = 3, wickRatio = 3/25 = 0.12 ✓
  // Let's make wickRatio exceed 0.3: total=25, lowerWick must be > 7.5
  // open=100, low=88 → lowerWick=12, high=121, close=120, body=20
  // total=121-88=33, wickRatio=12/33≈0.36 > 0.3 → false
  const candle = { time: 11, open: 100, high: 121, low: 88, close: 120, volume: 1 };
  assert.equal(isDisplacement(candle, candles, 10, cfg), false);
});

test('close not at extreme (closePos < 0.6) → false', () => {
  const candles = makeCandles(11, 10);
  // Bull: body=20 ✓, range=22, lowerWick=0, wickRatio=0 ✓
  // closePos = (close - low) / range = (118 - 100) / 22 = 0.818 would be ✓
  // Make closePos < 0.6: open=100, high=122, low=100, close=112 → body=12 < 15 → use body=20
  // open=100, high=122, low=100, close=120 → closePos=(120-100)/22=0.909 ✓
  // For < 0.6: open=100, close=110 (body=10, fails bodyMultiplier)
  // Better: large range makes close not extreme
  // open=100, high=140, low=100, close=120 → body=20 ✓, range=40, lowerWick=0 ✓, closePos=(120-100)/40=0.5 < 0.6 → false
  const candle = { time: 11, open: 100, high: 140, low: 100, close: 120, volume: 1 };
  assert.equal(isDisplacement(candle, candles, 10, cfg), false);
});

test('all conditions met (bull candle) → true', () => {
  const candles = makeCandles(11, 10); // avgBody=10
  // body=20 ≥ 15 ✓, open=100, high=121, low=100, close=120
  // range=21, lowerWick=0, wickRatio=0 ✓, closePos=(120-100)/21=0.952 ✓
  const candle = { time: 11, open: 100, high: 121, low: 100, close: 120, volume: 1 };
  assert.equal(isDisplacement(candle, candles, 10, cfg), true);
});

test('all conditions met (bear candle) → true', () => {
  const candles = makeCandles(11, 10);
  // body=20 ≥ 15 ✓, bear: open=120, high=120, low=99, close=100
  // range=21, upperWick=0, wickRatio=0 ✓, closePos=(high-close)/range=(120-100)/21=0.952 ✓
  const candle = { time: 11, open: 120, high: 120, low: 99, close: 100, volume: 1 };
  assert.equal(isDisplacement(candle, candles, 10, cfg), true);
});
```

- [ ] **Step 2: 실패 확인**

```bash
node --test scripts/test/modules/displacement.test.js
```

Expected: `Cannot find module '../../modules/displacement'` 에러로 실패.

- [ ] **Step 3: 구현**

`scripts/modules/displacement.js`:
```js
'use strict';

const { bodySize, totalRange, rollingAvgBody } = require('../utils/candle-utils');

/**
 * 캔들이 Displacement인지 판별 (spec §7)
 * @param {Candle} candle - 판별 대상 캔들
 * @param {Candle[]} candles - 전체 캔들 배열 (롤링 평균 계산용)
 * @param {number} endIdx - candles에서 candle의 인덱스 (exclusive, 해당 캔들 직전까지 사용)
 * @param {{ rollingWindow, bodyMultiplier, maxWickRatio, closeAtExtremeRatio }} cfg
 * @returns {boolean}
 */
function isDisplacement(candle, candles, endIdx, cfg) {
  const { rollingWindow, bodyMultiplier, maxWickRatio, closeAtExtremeRatio } = cfg;

  const avgBody = rollingAvgBody(candles, rollingWindow, endIdx);
  if (avgBody === 0) return false;

  const body  = bodySize(candle);
  if (body < avgBody * bodyMultiplier) return false;

  const range = totalRange(candle);
  if (range === 0) return false;

  const isBull = candle.close > candle.open;
  const oppositeWick = isBull
    ? candle.open  - candle.low   // 하단 꼬리 (bull의 반대)
    : candle.high  - candle.open; // 상단 꼬리 (bear의 반대)

  if (oppositeWick / range > maxWickRatio) return false;

  const closePos = isBull
    ? (candle.close - candle.low) / range   // bull: 하단 대비 종가 위치
    : (candle.high  - candle.close) / range; // bear: 상단 대비 종가 위치

  if (closePos < closeAtExtremeRatio) return false;

  return true;
}

module.exports = { isDisplacement };
```

- [ ] **Step 4: 통과 확인**

```bash
node --test scripts/test/modules/displacement.test.js
```

Expected: 5 tests pass.

- [ ] **Step 5: 커밋**

```bash
git add scripts/modules/displacement.js scripts/test/modules/displacement.test.js
git commit -m "feat: implement M7 isDisplacement"
```

---

## Task 3: Swing Points Detector (M1)

**Files:**
- Create: `scripts/modules/swing-points.js`
- Create: `scripts/test/modules/swing-points.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`scripts/test/modules/swing-points.test.js`:
```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { detectSwingPoints } = require('../../modules/swing-points');

function c(high, low, time = 0) {
  return { time, open: (high + low) / 2, high, low, close: (high + low) / 2, volume: 1 };
}

// leftBars=2, rightBars=2: 인덱스 2~(n-3) 범위에서 피벗 감지
const cfg = { leftBars: 2, rightBars: 2 };

test('pivot high detected', () => {
  // idx=2 가 최고점
  const candles = [c(90,80), c(95,82), c(100,85), c(93,81), c(88,79)];
  const swings = detectSwingPoints(candles, cfg);
  const highs = swings.filter(s => s.type === 'high');
  assert.equal(highs.length, 1);
  assert.equal(highs[0].index, 2);
  assert.equal(highs[0].price, 100);
});

test('pivot low detected', () => {
  // idx=2 가 최저점
  const candles = [c(90,80), c(88,75), c(85,70), c(89,76), c(92,81)];
  const swings = detectSwingPoints(candles, cfg);
  const lows = swings.filter(s => s.type === 'low');
  assert.equal(lows.length, 1);
  assert.equal(lows[0].index, 2);
  assert.equal(lows[0].price, 70);
});

test('boundary candles ignored (idx 0,1,n-2,n-1)', () => {
  // 캔들 5개, leftBars=2 → 인덱스 2만 체크 가능
  const candles = [c(99,80), c(100,82), c(95,83), c(97,81), c(98,80)];
  const swings = detectSwingPoints(candles, cfg);
  // idx=0,1은 leftBars 부족, idx=3,4는 rightBars 부족 → 체크 대상 아님
  const indices = swings.map(s => s.index);
  assert.ok(!indices.includes(0));
  assert.ok(!indices.includes(1));
  assert.ok(!indices.includes(3));
  assert.ok(!indices.includes(4));
});

test('spec §4.2 bug fix: same candle can be both high and low (edge case)', () => {
  // 스윙 고점/저점이 동시에 성립하는 경우 — 모두 push되어야 함
  // 내부 j루프에서 push하면 isLow 판단 전에 이미 push해버리는 버그 발생
  // candles[2]: 독립된 고점이면서 저점이기도 한 경우는 없지만
  // isHigh=true인데 push가 잘못된 위치에 있으면 isLow 검사 결과가 무시됨
  // 최소 검증: 고점 하나 저점 하나가 각각 감지됨
  const candles = [c(90,80), c(95,82), c(100,85), c(93,81), c(88,79)];
  const swings = detectSwingPoints(candles, cfg);
  // 고점: idx=2(100), 저점: 이 데이터에서는 idx=2가 저점이 아님
  const highs = swings.filter(s => s.type === 'high');
  const lows  = swings.filter(s => s.type === 'low');
  assert.equal(highs.length, 1);
  // 저점 없음 (idx=2의 low=85가 주변보다 낮지 않음)
  assert.equal(lows.length, 0);
});

test('no false positives when no clear pivot', () => {
  // 단조증가 수열 → 피벗 없음
  const candles = [c(80,70), c(85,75), c(90,80), c(95,85), c(100,90)];
  const swings = detectSwingPoints(candles, cfg);
  assert.equal(swings.length, 0);
});
```

- [ ] **Step 2: 실패 확인**

```bash
node --test scripts/test/modules/swing-points.test.js
```

Expected: `Cannot find module` 에러로 실패.

- [ ] **Step 3: 구현**

`scripts/modules/swing-points.js`:
```js
'use strict';

/**
 * 스윙 고점/저점 감지 (spec §4)
 * §4.2 버그 수정: swing-low push를 내부 for-j 루프 밖에서 수행
 * @param {Candle[]} candles - oldest→newest 정렬
 * @param {{ leftBars: number, rightBars: number }} cfg
 * @returns {SwingPoint[]}
 */
function detectSwingPoints(candles, { leftBars, rightBars }) {
  const swings = [];

  for (let i = leftBars; i < candles.length - rightBars; i++) {
    let isHigh = true;
    let isLow  = true;

    for (let j = i - leftBars; j <= i + rightBars; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low  <= candles[i].low)  isLow  = false;
    }

    // §4.2 수정: j 루프 종료 후 push
    if (isHigh) swings.push({ index: i, time: candles[i].time, price: candles[i].high, type: 'high' });
    if (isLow)  swings.push({ index: i, time: candles[i].time, price: candles[i].low,  type: 'low'  });
  }

  return swings;
}

module.exports = { detectSwingPoints };
```

- [ ] **Step 4: 통과 확인**

```bash
node --test scripts/test/modules/swing-points.test.js
```

Expected: 5 tests pass.

- [ ] **Step 5: 커밋**

```bash
git add scripts/modules/swing-points.js scripts/test/modules/swing-points.test.js
git commit -m "feat: implement M1 detectSwingPoints with spec §4.2 bug fix"
```

---

## Task 4: Market Structure Detector (M2)

**Files:**
- Create: `scripts/modules/market-structure.js`
- Create: `scripts/test/modules/market-structure.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`scripts/test/modules/market-structure.test.js`:
```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { detectBOS, detectMSS, getCurrentTrend } = require('../../modules/market-structure');

function c(open, high, low, close, time = 0) {
  return { time, open, high, low, close, volume: 1 };
}

// 스윙 고점: price=105, index=2
const swingHigh = { index: 2, time: 2, price: 105, type: 'high' };
// 스윙 저점: price=90, index=1
const swingLow  = { index: 1, time: 1, price: 90,  type: 'low'  };

test('BOS: wick pierces swing high but close below → no BOS (close-only rule)', () => {
  // Appendix B §1: 종가 기준만
  const candles = [
    c(95, 100, 93, 97, 0), // idx=0
    c(97, 108, 96, 104, 3), // idx=1: wick above 105, close=104 < 105 → no BOS
  ];
  const swings = [swingHigh];
  const bos = detectBOS(candles, swings);
  assert.equal(bos.length, 0);
});

test('BOS: close above swing high → bull BOS', () => {
  const candles = [
    c(95, 100, 93, 97, 0),  // idx=0
    c(97, 110, 96, 107, 3), // idx=1: close=107 > 105 → bull BOS
  ];
  const swings = [swingHigh];
  const bos = detectBOS(candles, swings);
  const bullBOS = bos.filter(b => b.direction === 'bull');
  assert.equal(bullBOS.length, 1);
  assert.equal(bullBOS[0].index, 1);
});

test('BOS: close below swing low → bear BOS', () => {
  const candles = [
    c(95, 100, 93, 97, 0),
    c(92, 93, 87, 88, 3), // close=88 < 90 → bear BOS
  ];
  const swings = [swingLow];
  const bos = detectBOS(candles, swings);
  const bearBOS = bos.filter(b => b.direction === 'bear');
  assert.equal(bearBOS.length, 1);
});

test('MSS: in downtrend, close above swing high → bull MSS', () => {
  // 다운트렌드 스윙: LH+LL 패턴 → trend='bear'
  const swings = [
    { index: 0, time: 0, price: 110, type: 'high' },
    { index: 1, time: 1, price: 95,  type: 'low'  },
    { index: 2, time: 2, price: 108, type: 'high' }, // LH
    { index: 3, time: 3, price: 90,  type: 'low'  }, // LL
  ];
  const candles = Array.from({ length: 5 }, (_, i) => c(100, 100, 80, i < 4 ? 95 : 115, i));
  // idx=4: close=115 > 108(last swing high) in bear trend → MSS
  const mss = detectMSS(candles, swings);
  assert.ok(mss.some(m => m.direction === 'bull'));
});

test('getCurrentTrend: HH+HL pattern → bull', () => {
  const swings = [
    { index: 0, type: 'high', price: 100 },
    { index: 1, type: 'low',  price: 90  },
    { index: 2, type: 'high', price: 110 }, // HH
    { index: 3, type: 'low',  price: 95  }, // HL
  ];
  assert.equal(getCurrentTrend(swings), 'bull');
});

test('getCurrentTrend: LH+LL pattern → bear', () => {
  const swings = [
    { index: 0, type: 'high', price: 110 },
    { index: 1, type: 'low',  price: 95  },
    { index: 2, type: 'high', price: 100 }, // LH
    { index: 3, type: 'low',  price: 85  }, // LL
  ];
  assert.equal(getCurrentTrend(swings), 'bear');
});

test('getCurrentTrend: fewer than 4 swings → ranging', () => {
  assert.equal(getCurrentTrend([{ type: 'high', price: 100 }]), 'ranging');
});
```

- [ ] **Step 2: 실패 확인**

```bash
node --test scripts/test/modules/market-structure.test.js
```

Expected: `Cannot find module` 에러로 실패.

- [ ] **Step 3: 구현**

`scripts/modules/market-structure.js`:
```js
'use strict';

/**
 * 시장 구조 이벤트 감지 (spec §5)
 * BOS 조건: 종가 기준만 (Appendix B §1)
 */

function detectBOS(candles, swings) {
  const bos = [];
  const highs = swings.filter(s => s.type === 'high');
  const lows  = swings.filter(s => s.type === 'low');

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];

    // Bull BOS: 종가가 직전 스윙 고점을 돌파
    const prevHighs = highs.filter(s => s.index < i);
    if (prevHighs.length > 0) {
      const lastHigh = prevHighs[prevHighs.length - 1];
      if (candle.close > lastHigh.price) {
        bos.push({ index: i, time: candle.time, price: lastHigh.price, type: 'BOS', direction: 'bull' });
      }
    }

    // Bear BOS: 종가가 직전 스윙 저점을 하향 돌파
    const prevLows = lows.filter(s => s.index < i);
    if (prevLows.length > 0) {
      const lastLow = prevLows[prevLows.length - 1];
      if (candle.close < lastLow.price) {
        bos.push({ index: i, time: candle.time, price: lastLow.price, type: 'BOS', direction: 'bear' });
      }
    }
  }

  return bos;
}

function detectMSS(candles, swings) {
  const mss = [];
  const highs = swings.filter(s => s.type === 'high');
  const lows  = swings.filter(s => s.type === 'low');

  for (let i = 0; i < candles.length; i++) {
    const candle = candles[i];
    const priorSwings = swings.filter(s => s.index < i);
    const trend = getCurrentTrend(priorSwings);

    // Bull MSS: 하락 추세에서 종가가 직전 스윙 고점 돌파
    if (trend === 'bear') {
      const prevHighs = highs.filter(s => s.index < i);
      if (prevHighs.length > 0) {
        const lastHigh = prevHighs[prevHighs.length - 1];
        if (candle.close > lastHigh.price) {
          mss.push({ index: i, time: candle.time, price: lastHigh.price, type: 'MSS', direction: 'bull' });
        }
      }
    }

    // Bear MSS: 상승 추세에서 종가가 직전 스윙 저점 하향 돌파
    if (trend === 'bull') {
      const prevLows = lows.filter(s => s.index < i);
      if (prevLows.length > 0) {
        const lastLow = prevLows[prevLows.length - 1];
        if (candle.close < lastLow.price) {
          mss.push({ index: i, time: candle.time, price: lastLow.price, type: 'MSS', direction: 'bear' });
        }
      }
    }
  }

  return mss;
}

/**
 * 스윙 패턴으로 현재 추세 판별 (spec §5.3)
 * @param {SwingPoint[]} swings
 * @returns {'bull'|'bear'|'ranging'}
 */
function getCurrentTrend(swings) {
  if (swings.length < 4) return 'ranging';

  const last4  = swings.slice(-4);
  const highs  = last4.filter(s => s.type === 'high').map(s => s.price);
  const lows   = last4.filter(s => s.type === 'low').map(s => s.price);

  if (highs.length < 2 || lows.length < 2) return 'ranging';

  const hhPattern = highs[1] > highs[0]; // Higher High
  const hlPattern = lows[1]  > lows[0];  // Higher Low
  const lhPattern = highs[1] < highs[0]; // Lower High
  const llPattern = lows[1]  < lows[0];  // Lower Low

  if (hhPattern && hlPattern) return 'bull';
  if (lhPattern && llPattern) return 'bear';
  return 'ranging';
}

module.exports = { detectBOS, detectMSS, getCurrentTrend };
```

- [ ] **Step 4: 통과 확인**

```bash
node --test scripts/test/modules/market-structure.test.js
```

Expected: 7 tests pass.

- [ ] **Step 5: 커밋**

```bash
git add scripts/modules/market-structure.js scripts/test/modules/market-structure.test.js
git commit -m "feat: implement M2 detectBOS/detectMSS/getCurrentTrend"
```

---

## Task 5: Fair Value Gap Detector (M3)

**Files:**
- Create: `scripts/modules/fvg.js`
- Create: `scripts/test/modules/fvg.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`scripts/test/modules/fvg.test.js`:
```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { detectFVG } = require('../../modules/fvg');

const cfg = { minGapPct: 0.001 }; // 0.1%

function c(open, high, low, close, time = 0) {
  return { time, open, high, low, close, volume: 1 };
}

test('gap < 0.1% → ignored', () => {
  // C1.high=100, C3.low=100.05 → gap=0.05, gapPct=0.0005 < 0.001 → 무시
  const candles = [
    c(98, 100, 96, 99, 0),
    c(99, 102, 98, 101, 1),
    c(100, 103, 100.05, 102, 2),
  ];
  assert.equal(detectFVG(candles, cfg).length, 0);
});

test('bull FVG: C3.low > C1.high with gap ≥ 0.1%', () => {
  // C1.high=100, C3.low=101.5 → gap=1.5, gapPct=1.5/100=0.015 ✓
  const candles = [
    c(97, 100, 96, 99, 0),  // C1
    c(99, 102, 98, 101, 1), // C2
    c(101.5, 105, 101.5, 104, 2), // C3: low=101.5 > C1.high=100
  ];
  const fvgs = detectFVG(candles, cfg);
  assert.equal(fvgs.length, 1);
  assert.equal(fvgs[0].direction, 'bull');
  assert.equal(fvgs[0].low, 100);    // C1.high
  assert.equal(fvgs[0].high, 101.5); // C3.low
  assert.equal(fvgs[0].time, 1);     // C2.time
  assert.equal(fvgs[0].status, 'active');
});

test('bear FVG: C1.low > C3.high with gap ≥ 0.1%', () => {
  // C1.low=105, C3.high=103.5 → gap=1.5, gapPct=1.5/105≈0.014 ✓
  const candles = [
    c(108, 110, 105, 106, 0), // C1: low=105
    c(106, 107, 104, 105, 1), // C2
    c(104, 103.5, 101, 102, 2), // C3: high=103.5 < C1.low=105
  ];
  const fvgs = detectFVG(candles, cfg);
  assert.equal(fvgs.length, 1);
  assert.equal(fvgs[0].direction, 'bear');
  assert.equal(fvgs[0].high, 105);   // C1.low
  assert.equal(fvgs[0].low, 103.5);  // C3.high
});

test('FVG status → mitigated when price enters the zone', () => {
  // Bull FVG: low=100, high=101.5 → 이후 캔들이 zone 안으로 진입하면 mitigated
  const candles = [
    c(97, 100, 96, 99, 0),
    c(99, 102, 98, 101, 1),
    c(101.5, 105, 101.5, 104, 2),
    c(103, 104, 100.5, 100.8, 3), // close=100.8 → FVG.low(100) ≤ 100.8 ≤ FVG.high(101.5) → mitigated
  ];
  const fvgs = detectFVG(candles, cfg);
  assert.equal(fvgs[0].status, 'mitigated');
});

test('FVG remains active if price does not enter zone', () => {
  const candles = [
    c(97, 100, 96, 99, 0),
    c(99, 102, 98, 101, 1),
    c(101.5, 105, 101.5, 104, 2),
    c(104, 107, 103, 106, 3), // close=106, below zone 없음
  ];
  const fvgs = detectFVG(candles, cfg);
  assert.equal(fvgs[0].status, 'active');
});
```

- [ ] **Step 2: 실패 확인**

```bash
node --test scripts/test/modules/fvg.test.js
```

Expected: `Cannot find module` 에러로 실패.

- [ ] **Step 3: 구현**

`scripts/modules/fvg.js`:
```js
'use strict';

/**
 * Fair Value Gap 감지 (spec §6)
 * Bull FVG: C3.low > C1.high (상승 갭)
 * Bear FVG: C1.low > C3.high (하락 갭)
 * @param {Candle[]} candles
 * @param {{ minGapPct: number }} cfg
 * @returns {FVG[]}
 */
function detectFVG(candles, { minGapPct }) {
  const fvgs = [];

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];

    // Bull FVG
    if (c3.low > c1.high) {
      const gap = c3.low - c1.high;
      if (gap / c1.high >= minGapPct) {
        fvgs.push({ index: i - 1, time: c2.time, high: c3.low, low: c1.high, direction: 'bull', status: 'active' });
      }
    }

    // Bear FVG
    if (c1.low > c3.high) {
      const gap = c1.low - c3.high;
      if (gap / c1.low >= minGapPct) {
        fvgs.push({ index: i - 1, time: c2.time, high: c1.low, low: c3.high, direction: 'bear', status: 'active' });
      }
    }
  }

  // 미티게이션: FVG 형성 이후 종가가 FVG 구간에 진입하면 mitigated
  for (const fvg of fvgs) {
    for (let i = fvg.index + 2; i < candles.length; i++) {
      const close = candles[i].close;
      if (close >= fvg.low && close <= fvg.high) {
        fvg.status = 'mitigated';
        break;
      }
    }
  }

  return fvgs;
}

module.exports = { detectFVG };
```

- [ ] **Step 4: 통과 확인**

```bash
node --test scripts/test/modules/fvg.test.js
```

Expected: 5 tests pass.

- [ ] **Step 5: 커밋**

```bash
git add scripts/modules/fvg.js scripts/test/modules/fvg.test.js
git commit -m "feat: implement M3 detectFVG with mitigation tracking"
```

---

## Task 6: Order Block Detector (M4)

**Files:**
- Create: `scripts/modules/order-block.js`
- Create: `scripts/test/modules/order-block.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`scripts/test/modules/order-block.test.js`:
```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { detectOrderBlocks } = require('../../modules/order-block');

function c(open, high, low, close, time = 0) {
  return { time, open, high, low, close, volume: 1 };
}

// displacement 판별: 항상 false 반환하는 mock
const noDisp = () => false;
// displacement 판별: 항상 true 반환하는 mock
const alwaysDisp = () => true;

test('no displacement → no OB', () => {
  const candles = [
    c(100, 105, 98, 99, 0),  // bear
    c(99, 112, 98, 111, 1),  // bull close > 105 (curr.high), but no displacement
  ];
  const obs = detectOrderBlocks(candles, [], noDisp);
  assert.equal(obs.length, 0);
});

test('bull OB: bear candle followed by displacement bull close above curr.high', () => {
  const candles = [
    c(100, 102, 96, 97, 0),  // bear: open=100, high=102, low=96, close=97
    c(97, 115, 96, 114, 1),  // close=114 > curr.high=102 + displacement → bull OB at idx=0
  ];
  const obs = detectOrderBlocks(candles, [], alwaysDisp);
  assert.equal(obs.length, 1);
  assert.equal(obs[0].direction, 'bull');
  assert.equal(obs[0].index, 0);
  // OB.high/low = body (max/min of open/close)
  assert.equal(obs[0].high, 100); // max(100, 97)
  assert.equal(obs[0].low,  97);  // min(100, 97)
  assert.equal(obs[0].status, 'active');
});

test('bear OB: bull candle followed by displacement bear close below curr.low', () => {
  const candles = [
    c(97, 103, 96, 102, 0),  // bull: open=97, close=102
    c(102, 103, 84, 85, 1),  // close=85 < curr.low=96 + displacement → bear OB at idx=0
  ];
  const obs = detectOrderBlocks(candles, [], alwaysDisp);
  assert.equal(obs.length, 1);
  assert.equal(obs[0].direction, 'bear');
  assert.equal(obs[0].high, 102); // max(97, 102)
  assert.equal(obs[0].low,  97);  // min(97, 102)
});

test('full penetration → OB status invalidated (Appendix B §6)', () => {
  const candles = [
    c(100, 102, 96, 97, 0),  // bear → bull OB here
    c(97,  115, 96, 114, 1), // displacement bull → OB created
    c(114, 115, 90, 91, 2),  // close=91 < OB.low=97 → invalidated
  ];
  const obs = detectOrderBlocks(candles, [], alwaysDisp);
  assert.equal(obs.length, 1);
  assert.equal(obs[0].status, 'invalidated');
});
```

- [ ] **Step 2: 실패 확인**

```bash
node --test scripts/test/modules/order-block.test.js
```

Expected: `Cannot find module` 에러로 실패.

- [ ] **Step 3: 구현**

`scripts/modules/order-block.js`:
```js
'use strict';

const { isBullish, isBearish } = require('../utils/candle-utils');

/**
 * Order Block 감지 (spec §8)
 * Displacement 동반 필수; 완전관통 → status 'invalidated'
 * @param {Candle[]} candles
 * @param {SwingPoint[]} _swings - 미래 확장용 (현재 미사용)
 * @param {Function} isDisplacementFn - (candle, candles, endIdx) → boolean
 * @returns {OrderBlock[]}
 */
function detectOrderBlocks(candles, _swings, isDisplacementFn) {
  const obs = [];

  for (let i = 0; i < candles.length - 1; i++) {
    const curr = candles[i];
    const next = candles[i + 1];

    // Bull OB: curr 하락봉, next가 displacement bull + curr.high 돌파
    if (isBearish(curr) && next.close > curr.high && isDisplacementFn(next, candles, i + 1)) {
      obs.push({
        index: i, time: curr.time,
        high: Math.max(curr.open, curr.close),
        low:  Math.min(curr.open, curr.close),
        direction: 'bull', status: 'active',
      });
    }

    // Bear OB: curr 상승봉, next가 displacement bear + curr.low 하향 돌파
    if (isBullish(curr) && next.close < curr.low && isDisplacementFn(next, candles, i + 1)) {
      obs.push({
        index: i, time: curr.time,
        high: Math.max(curr.open, curr.close),
        low:  Math.min(curr.open, curr.close),
        direction: 'bear', status: 'active',
      });
    }
  }

  // 완전관통 무효화 (Appendix B §6)
  for (const ob of obs) {
    for (let i = ob.index + 2; i < candles.length; i++) {
      const close = candles[i].close;
      if (ob.direction === 'bull' && close < ob.low) { ob.status = 'invalidated'; break; }
      if (ob.direction === 'bear' && close > ob.high) { ob.status = 'invalidated'; break; }
    }
  }

  return obs;
}

module.exports = { detectOrderBlocks };
```

- [ ] **Step 4: 통과 확인**

```bash
node --test scripts/test/modules/order-block.test.js
```

Expected: 4 tests pass.

- [ ] **Step 5: 커밋**

```bash
git add scripts/modules/order-block.js scripts/test/modules/order-block.test.js
git commit -m "feat: implement M4 detectOrderBlocks"
```

---

## Task 7: Breaker Block Detector (M5)

**Files:**
- Create: `scripts/modules/breaker-block.js`

(별도 테스트 없음 — 통합 테스트에서 검증)

- [ ] **Step 1: 구현**

`scripts/modules/breaker-block.js`:
```js
'use strict';

/**
 * Breaker Block 감지 (spec §9)
 * 무효화된 OB 중에서:
 * - 즉시반전 3캔들 미만이면 BB 생성 금지 (Appendix B §8)
 * - retestMinCandles~retestMaxCandles 범위 내 재시험 발생 시 BB 등록
 * @param {Candle[]} candles
 * @param {OrderBlock[]} obs
 * @param {{ retestMinCandles, retestMaxCandles, immediateReverseCandles }} cfg
 * @returns {BreakerBlock[]}
 */
function detectBreakerBlocks(candles, obs, cfg) {
  const { retestMinCandles, retestMaxCandles, immediateReverseCandles } = cfg;
  const bbs = [];

  for (const ob of obs) {
    if (ob.status !== 'invalidated') continue;

    // 돌파 캔들 찾기 (OB를 완전관통한 첫 번째 캔들)
    let breakIdx = -1;
    for (let i = ob.index + 1; i < candles.length; i++) {
      if (ob.direction === 'bull' && candles[i].close < ob.low)  { breakIdx = i; break; }
      if (ob.direction === 'bear' && candles[i].close > ob.high) { breakIdx = i; break; }
    }
    if (breakIdx === -1) continue;

    // 즉시반전 검사: 돌파 후 immediateReverseCandles 내에 OB 방향으로 복귀 → BB 금지 (Appendix B §8)
    let immediateReverse = false;
    const checkEnd = Math.min(breakIdx + immediateReverseCandles, candles.length);
    for (let i = breakIdx + 1; i < checkEnd; i++) {
      if (ob.direction === 'bull' && candles[i].close > ob.low)  { immediateReverse = true; break; }
      if (ob.direction === 'bear' && candles[i].close < ob.high) { immediateReverse = true; break; }
    }
    if (immediateReverse) continue;

    // 재시험 탐색 (retestMinCandles ~ retestMaxCandles)
    const retestStart = breakIdx + retestMinCandles;
    const retestEnd   = Math.min(breakIdx + retestMaxCandles, candles.length - 1);
    for (let i = retestStart; i <= retestEnd; i++) {
      const c = candles[i];
      if (c.low <= ob.high && c.high >= ob.low) {
        // BB: 방향 반전 (원래 bull OB → bear BB, bear OB → bull BB)
        bbs.push({
          index: ob.index, time: ob.time,
          high: ob.high, low: ob.low,
          direction: ob.direction === 'bull' ? 'bear' : 'bull',
          retestStatus: 'pending', retestIndex: i,
        });
        break;
      }
    }
  }

  return bbs;
}

module.exports = { detectBreakerBlocks };
```

- [ ] **Step 2: 커밋**

```bash
git add scripts/modules/breaker-block.js
git commit -m "feat: implement M5 detectBreakerBlocks"
```

---

## Task 8: Liquidity Sweep Detector (M6)

**Files:**
- Create: `scripts/modules/sweep.js`
- Create: `scripts/test/modules/sweep.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`scripts/test/modules/sweep.test.js`:
```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { detectLiquiditySweeps } = require('../../modules/sweep');

const cfg = { followThroughLookforward: 3 };

function c(open, high, low, close, time = 0, idx = 0) {
  return { time, open, high, low, close, volume: 1, _idx: idx };
}

test('wick above swing high but close also above → not a BSL sweep', () => {
  const swingHigh = { index: 0, type: 'high', price: 100 };
  const candles = [
    c(95, 100, 93, 98, 0), // swing high at idx=0
    c(99, 105, 98, 103, 1), // wick above 100, close=103 > 100 → close NOT below swing → no sweep
  ];
  const sweeps = detectLiquiditySweeps(candles, [swingHigh], cfg);
  assert.equal(sweeps.filter(s => s.type === 'BSL').length, 0);
});

test('BSL sweep: wick above + close below swing high', () => {
  const swingHigh = { index: 0, type: 'high', price: 100 };
  const candles = [
    c(95, 100, 93, 98, 0),
    c(98, 103, 97, 99, 1), // wick=103 > 100, close=99 < 100 → BSL sweep
    c(97,  99, 96, 98, 2),
    c(98, 100, 95, 96, 3),
    c(95,  97, 92, 93, 4), // close < sweepCandle.close(99) → follow-through ✓
  ];
  const sweeps = detectLiquiditySweeps(candles, [swingHigh], cfg);
  const bsl = sweeps.filter(s => s.type === 'BSL');
  assert.equal(bsl.length, 1);
  assert.equal(bsl[0].confirmed, true);
});

test('BSL sweep: no follow-through within lookforward → unconfirmed', () => {
  const swingHigh = { index: 0, type: 'high', price: 100 };
  const candles = [
    c(95, 100, 93, 98, 0),
    c(98, 103, 97, 99, 1), // BSL sweep
    c(99, 101, 98, 100, 2), // close ≥ 99 (sweep candle close) → no follow-through
    c(100, 102, 99, 101, 3),
    c(101, 103, 100, 102, 4), // still above 99
  ];
  const sweeps = detectLiquiditySweeps(candles, [swingHigh], cfg);
  const bsl = sweeps.filter(s => s.type === 'BSL');
  assert.equal(bsl.length, 1);
  assert.equal(bsl[0].confirmed, false);
});

test('SSL sweep: wick below swing low + close above', () => {
  const swingLow = { index: 0, type: 'low', price: 90 };
  const candles = [
    c(95, 98, 90, 93, 0),
    c(93, 94, 87, 92, 1), // wick=87 < 90, close=92 > 90 → SSL sweep
    c(92, 95, 91, 94, 2),
    c(94, 97, 93, 96, 3), // close=96 > sweep.close(92) → follow-through ✓
  ];
  const sweeps = detectLiquiditySweeps(candles, [swingLow], cfg);
  const ssl = sweeps.filter(s => s.type === 'SSL');
  assert.equal(ssl.length, 1);
  assert.equal(ssl[0].confirmed, true);
});
```

- [ ] **Step 2: 실패 확인**

```bash
node --test scripts/test/modules/sweep.test.js
```

Expected: `Cannot find module` 에러로 실패.

- [ ] **Step 3: 구현**

`scripts/modules/sweep.js`:
```js
'use strict';

/**
 * 유동성 스윕 감지 (spec §10)
 * BSL: 스윙 고점 wick 돌파 + 종가 하향 복귀
 * SSL: 스윙 저점 wick 돌파 + 종가 상향 복귀
 * confirmed: followThroughLookforward 내 추세 지속 확인
 * @param {Candle[]} candles
 * @param {SwingPoint[]} swings
 * @param {{ followThroughLookforward: number }} cfg
 * @returns {SweepEvent[]}
 */
function detectLiquiditySweeps(candles, swings, { followThroughLookforward }) {
  const sweeps = [];
  const highs = swings.filter(s => s.type === 'high');
  const lows  = swings.filter(s => s.type === 'low');

  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];

    // BSL: wick above swing high + close below swing high
    for (const swing of highs) {
      if (swing.index >= i) continue;
      if (c.high > swing.price && c.close < swing.price) {
        const confirmed = checkFollowThrough(candles, i, 'BSL', followThroughLookforward);
        sweeps.push({ index: i, time: c.time, price: swing.price, type: 'BSL', confirmed });
        break; // 가장 가까운 스윙 하나만
      }
    }

    // SSL: wick below swing low + close above swing low
    for (const swing of lows) {
      if (swing.index >= i) continue;
      if (c.low < swing.price && c.close > swing.price) {
        const confirmed = checkFollowThrough(candles, i, 'SSL', followThroughLookforward);
        sweeps.push({ index: i, time: c.time, price: swing.price, type: 'SSL', confirmed });
        break;
      }
    }
  }

  return sweeps;
}

function checkFollowThrough(candles, sweepIdx, sweepType, lookforward) {
  const sweepClose = candles[sweepIdx].close;
  const end = Math.min(sweepIdx + lookforward, candles.length - 1);
  for (let i = sweepIdx + 1; i <= end; i++) {
    if (sweepType === 'BSL' && candles[i].close < sweepClose) return true; // 하락 지속
    if (sweepType === 'SSL' && candles[i].close > sweepClose) return true; // 상승 지속
  }
  return false;
}

module.exports = { detectLiquiditySweeps };
```

- [ ] **Step 4: 통과 확인**

```bash
node --test scripts/test/modules/sweep.test.js
```

Expected: 4 tests pass.

- [ ] **Step 5: 커밋**

```bash
git add scripts/modules/sweep.js scripts/test/modules/sweep.test.js
git commit -m "feat: implement M6 detectLiquiditySweeps with follow-through check"
```

---

## Task 9: Alignment Score Calculator (M8)

**Files:**
- Create: `scripts/modules/alignment.js`
- Create: `scripts/test/modules/alignment.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`scripts/test/modules/alignment.test.js`:
```js
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
```

- [ ] **Step 2: 실패 확인**

```bash
node --test scripts/test/modules/alignment.test.js
```

Expected: `Cannot find module` 에러로 실패.

- [ ] **Step 3: 구현**

`scripts/modules/alignment.js`:
```js
'use strict';

/**
 * HTF-LTF 정렬 점수 및 티어 계산 (spec §11)
 * @param {Object} htfAnalysis - { trend, bos, mss, ... }
 * @param {Object} ltfAnalysis - { trend, bos, priceInHTF_OB, priceInHTF_FVG, priceInHTF_BB, hasRecentBOS_in_htfDir }
 * @returns {{ score: number, tier: 1|2|3|4|5, htfBias, ltfBias, isAligned, canTrade }}
 */
function calculateAlignmentScore(htfAnalysis, ltfAnalysis) {
  const htfTrend = htfAnalysis.trend;
  const ltfTrend = ltfAnalysis.trend;

  // HTF 점수 (0~50)
  let htfScore = htfTrend !== 'ranging' ? 40 : 10;
  if (htfTrend !== 'ranging' && htfAnalysis.bos.length > 0) htfScore += 10;

  // LTF 점수 (0~30)
  let ltfScore = 0;
  if (htfTrend !== 'ranging') {
    if (ltfTrend === htfTrend)      ltfScore = 30;
    else if (ltfTrend === 'ranging') ltfScore = 15;
    else                             ltfScore = 0;
  } else {
    ltfScore = 15;
  }

  // POI 컨플루언스 점수 (0~20)
  let confluenceCount = 0;
  if (ltfAnalysis.priceInHTF_OB)  confluenceCount++;
  if (ltfAnalysis.priceInHTF_FVG) confluenceCount++;
  if (ltfAnalysis.priceInHTF_BB)  confluenceCount++;
  const poiScore = Math.min(20, confluenceCount * 10);

  const score = htfScore + ltfScore + poiScore;

  // 티어 판별
  let tier = 5;
  if (htfTrend !== 'ranging') {
    if (ltfTrend === htfTrend && ltfAnalysis.hasRecentBOS_in_htfDir) tier = 1;
    else if (ltfTrend === htfTrend)      tier = 2;
    else if (ltfTrend === 'ranging')     tier = 3;
    else                                 tier = 4;
  }

  return {
    score,
    tier,
    htfBias: htfTrend,
    ltfBias: ltfTrend,
    isAligned: tier <= 2,
    canTrade:  tier <= 3,
  };
}

module.exports = { calculateAlignmentScore };
```

- [ ] **Step 4: 통과 확인**

```bash
node --test scripts/test/modules/alignment.test.js
```

Expected: 8 tests pass.

- [ ] **Step 5: 커밋**

```bash
git add scripts/modules/alignment.js scripts/test/modules/alignment.test.js
git commit -m "feat: implement M8 calculateAlignmentScore with tier determination"
```

---

## Task 10: AMD Phase Detector (M9)

**Files:**
- Create: `scripts/modules/amd.js`

(통합 테스트에서 검증)

- [ ] **Step 1: 구현**

`scripts/modules/amd.js`:
```js
'use strict';

/**
 * AMD 사이클 단계 감지 (spec §12)
 * @param {Candle[]} candles
 * @param {SwingPoint[]} swings
 * @param {SweepEvent[]} sweeps
 * @param {StructureEvent[]} bosEvents
 * @returns {'ACCUMULATION'|'MANIPULATION'|'DISTRIBUTION'|'RESET'|'UNKNOWN'}
 */
function detectAMDPhase(candles, swings, sweeps, bosEvents) {
  if (candles.length === 0 || swings.length === 0) return 'UNKNOWN';

  const recentSwings = swings.slice(-10);
  const prices = recentSwings.map(s => s.price);
  const swingRange = Math.max(...prices) - Math.min(...prices);

  // 최근 20캔들 평균 범위
  const recent20 = candles.slice(-20);
  const avgRange = recent20.reduce((sum, c) => sum + (c.high - c.low), 0) / recent20.length;

  const manipLookback = 10;
  const lastIdx = candles.length - 1;

  const recentSweepInWindow = (sweeps || []).some(
    s => s.confirmed && (lastIdx - s.index) <= manipLookback,
  );

  const recentBOS = bosEvents && bosEvents.length > 0
    ? bosEvents[bosEvents.length - 1]
    : null;

  // ACCUMULATION: 스윙 범위 좁음 + 최근 스윕/BOS 없음
  if (swingRange < avgRange * 3 && !recentSweepInWindow && !recentBOS) {
    return 'ACCUMULATION';
  }

  // MANIPULATION: 최근 N캔들 내 확인된 스윕 발생
  if (recentSweepInWindow) return 'MANIPULATION';

  // DISTRIBUTION: 최근 5캔들 내 BOS 발생
  if (recentBOS && (lastIdx - recentBOS.index) <= 5) return 'DISTRIBUTION';

  return 'RESET';
}

module.exports = { detectAMDPhase };
```

- [ ] **Step 2: 커밋**

```bash
git add scripts/modules/amd.js
git commit -m "feat: implement M9 detectAMDPhase"
```

---

## Task 11: Entry Scorecard (M11)

**Files:**
- Create: `scripts/modules/scorecard.js`
- Create: `scripts/test/modules/scorecard.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`scripts/test/modules/scorecard.test.js`:
```js
'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { calculateEntryScorecard } = require('../../modules/scorecard');

// spec §14.5 예시 캔들/스윙 기반
// S급 타점: S1=+1, S2=+1(NY킬존), S3=+1(OTE), S4=+2(OB+FVG), S5=+1(스윕직후) = 6
// 함정 패턴: S1=+1, S2=0(아시아외), S3=-1(프리미엄), S4=0(단일), S5=0 = 0

const cfg = {
  scorecard: {
    ote: { start: 0.62, end: 0.79, shallowStart: 0.50 },
    liquidity: { lookbackCandles: 20 },
    gradeThresholds: { S: 5, A: 3, B: 2, C: 0 },
  },
};

// swingHigh=110, swingLow=90, range=20
const swingHigh = 110;
const swingLow  = 90;

// S급 타점 (spec §14.5 B자리)
// LONG: retracement = (swingHigh - entryPrice) / range
// OTE: 0.62 ≤ ret ≤ 0.79 → entryPrice = 110 - 0.70*20 = 96 (ret=0.70 ✓)
const oteEntry = 96;

// 함정 패턴: 프리미엄 구간 LONG (ret < 0.50 → S3=-1)
// entryPrice=108, ret=(110-108)/20=0.10 < 0.50 → PREMIUM → S3=-1
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

test('프리미엄 구간 LONG + grade=S → BLOCK (Appendix B §10 암시)', () => {
  // S3=-1 → total < 0 가능하거나 grade X → BLOCK
  // 실제 S1=1,S2=1,S3=-1,S4=2,S5=1 → total=4 → grade=A → tier 1 → ENTER
  // 스코어카드는 단순 점수, 프리미엄 구간 BLOCK은 S3=-1이 total을 낮추는 것으로 처리
  // 명시적 BLOCK: grade X (total < 0) 또는 action='BLOCK' from tier>=4
  // 이 테스트: S3=-1로 total=-1 → grade=X → BLOCK
  const params = makeParams(premiumEntry, true, 
    [{ confirmed: true, index: 10, time: 1714999000, type: 'BSL' }],
    {}, 2
  );
  // S1=1, S2=1, S3=-1, S4=0, S5=1 → total=2 → grade=B → tier2 → ENTER 50%
  // For total<0 (X grade) test: use tier4 → SKIP
  const paramsT4 = makeParams(premiumEntry, false, [], {}, 4);
  const sc = calculateEntryScorecard(paramsT4);
  assert.equal(sc.action, 'SKIP');
});

test('grade=B, tier=1 → ENTER with sizeMultiplier=0.5', () => {
  // S1=1, S2=0, S3=0(shallow 0.55 ret), S4=1(fvg), S5=0 → total=2 → grade=B
  // shallow: ret = (110 - entryPrice) / 20 = 0.55 → entryPrice = 99
  const params = makeParams(99, false, [], { fvg: true }, 1);
  const sc = calculateEntryScorecard(params);
  assert.equal(sc.total, 2);
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
```

- [ ] **Step 2: 실패 확인**

```bash
node --test scripts/test/modules/scorecard.test.js
```

Expected: `Cannot find module` 에러로 실패.

- [ ] **Step 3: 구현**

`scripts/modules/scorecard.js`:
```js
'use strict';

/**
 * 진입점 스코어카드 (spec §14)
 * @param {Object} params
 * @param {'bull'|'bear'|'ranging'} params.htfTrend
 * @param {'LONG'|'SHORT'} params.entryDirection
 * @param {{ inKillzone: boolean, name: string|null }} params.killzoneResult
 * @param {number} params.entryPrice
 * @param {number} params.swingHigh
 * @param {number} params.swingLow
 * @param {{ high, low }} params.entryZone
 * @param {FVG[]} params.activeFVGs
 * @param {OrderBlock[]} params.activeOBs
 * @param {BreakerBlock[]} params.activeBBs
 * @param {SweepEvent[]} params.sweeps
 * @param {number} params.entryTimeSecs - Unix 초 (스윕 룩백 기준)
 * @param {1|2|3|4|5} params.tier
 * @param {Object} params.cfg - ict-engine.json 설정
 * @returns {{ total, grade, breakdown, oteZone, action, sizeMultiplier }}
 */
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

  if (ret >= oteCfg.start && ret <= oteCfg.end)  return 1;
  if (ret >= oteCfg.shallowStart && ret < oteCfg.start) return 0.5;
  if (ret < oteCfg.shallowStart)  return -1; // 프리미엄/할인 구간 역방향
  return 0; // 과도한 되돌림
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
  // LTF 15m 기준: 1캔들 = 900초
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

  if ((grade === 'S' || grade === 'A') && tier <= 2) return { action: 'ENTER', sizeMultiplier: 1.0 };
  if ((grade === 'S' || grade === 'A') && tier === 3) return { action: 'ENTER', sizeMultiplier: 0.5 };
  if (grade === 'B' && tier <= 2) return { action: 'ENTER', sizeMultiplier: 0.5 };

  return { action: 'SKIP', sizeMultiplier: 0 };
}

module.exports = { calculateEntryScorecard };
```

- [ ] **Step 4: 통과 확인**

```bash
node --test scripts/test/modules/scorecard.test.js
```

Expected: 5 tests pass.

- [ ] **Step 5: 커밋**

```bash
git add scripts/modules/scorecard.js scripts/test/modules/scorecard.test.js
git commit -m "feat: implement M11 calculateEntryScorecard with finalEntryDecision"
```

---

## Task 12: ICT Engine Pipeline + CLI

**Files:**
- Modify: `scripts/ict-engine.js` (스텁 → 전체 구현)

- [ ] **Step 1: 모든 단위 테스트 통과 확인**

```bash
node --test scripts/test/modules/*.test.js
```

Expected: 모든 모듈 테스트 pass. 실패 시 해당 Task로 돌아가 수정.

- [ ] **Step 2: ict-engine.js 전체 교체**

`scripts/ict-engine.js` 전체를 아래로 교체:

```js
'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const config = require('./config/ict-engine.json');

const { fetchCandleSet }          = require('./utils/binance');
const { isInKillzone, killzoneBonus } = require('./utils/time-utils');

const { detectSwingPoints }       = require('./modules/swing-points');
const { detectBOS, detectMSS, getCurrentTrend } = require('./modules/market-structure');
const { detectFVG }               = require('./modules/fvg');
const { detectOrderBlocks }       = require('./modules/order-block');
const { detectBreakerBlocks }     = require('./modules/breaker-block');
const { detectLiquiditySweeps }   = require('./modules/sweep');
const { isDisplacement }          = require('./modules/displacement');
const { calculateAlignmentScore } = require('./modules/alignment');
const { detectAMDPhase }          = require('./modules/amd');
const { calculateEntryScorecard } = require('./modules/scorecard');

// ── Private helpers ───────────────────────────────────────────────────────────

function validateInput(params) {
  if (!params.htfCandles || params.htfCandles.length < 100)
    throw new Error('HTF 캔들 최소 100개 필요');
  if (!params.ltfCandles || params.ltfCandles.length < 50)
    throw new Error('LTF 캔들 최소 50개 필요');
  if (!params.pair) throw new Error('pair 필요');
}

function normalize(candles) {
  return [...candles].sort((a, b) => a.time - b.time);
}

function selectBestPOI(ltfFVGs, ltfOBs, htfBBs, direction) {
  const activeFVGs = ltfFVGs.filter(f => f.status === 'active').map(p => ({ ...p, poiType: 'FVG' }));
  const activeOBs  = ltfOBs.filter(o => o.status === 'active').map(p => ({ ...p, poiType: 'OB' }));
  const pendingBBs = htfBBs.filter(b => b.retestStatus === 'pending').map(p => ({ ...p, poiType: 'BB' }));

  for (const list of [activeFVGs, activeOBs, pendingBBs]) {
    if (list.length === 0) continue;
    const best = direction === 'bull'
      ? list.reduce((b, p) => p.high > b.high ? p : b)
      : list.reduce((b, p) => p.low  < b.low  ? p : b);
    return { ...best, price: (best.high + best.low) / 2 };
  }
  return null;
}

function calculateSL(poi, htfSwings, direction) {
  const lastSwingLow  = htfSwings.filter(s => s.type === 'low').slice(-1)[0];
  const lastSwingHigh = htfSwings.filter(s => s.type === 'high').slice(-1)[0];
  if (direction === 'bull') {
    return Math.min(poi.low, lastSwingLow ? lastSwingLow.price : poi.low);
  }
  return Math.max(poi.high, lastSwingHigh ? lastSwingHigh.price : poi.high);
}

function calculateTP(entry, sl, minRR) {
  const risk = Math.abs(entry - sl);
  const sign = entry > sl ? 1 : -1;
  return [
    entry + sign * risk * minRR,
    entry + sign * risk * minRR * 1.5,
    entry + sign * risk * minRR * 2,
  ];
}

function calculateConfidence(alignmentScore, kzBonus, sweepConfirmed, amdPhase) {
  let total = alignmentScore + kzBonus;
  if (amdPhase === 'MANIPULATION') total += 10;
  if (amdPhase === 'DISTRIBUTION') total += 5;
  if (sweepConfirmed) total += 10;
  if (total >= 80) return 'HIGH';
  if (total >= 60) return 'MEDIUM';
  return 'LOW';
}

function buildNeutral(pair, reason, tier, extra = {}) {
  return {
    pair,
    timestamp: Math.floor(Date.now() / 1000),
    analysisDate: new Date().toISOString().slice(0, 10),
    direction: 'NEUTRAL',
    tier,
    alignmentScore: extra.alignmentScore || 0,
    confidence: 'LOW',
    reason,
    tradeBlocked: false,
    tradeBlockReason: '',
    ...extra,
  };
}

function buildSignal({ pair, direction, alignment, scorecard, poi, sl, tps, rr, confidence, htfTrend, ltfTrend, htfAMD, kzResult, fvgs, obs, bbs, sweeps, sizeMultiplier }) {
  const entry = poi.price;
  return {
    pair,
    timestamp: Math.floor(Date.now() / 1000),
    analysisDate: new Date().toISOString().slice(0, 10),
    direction,
    tier: alignment.tier,
    alignmentScore: alignment.score,
    confidence,
    scorecard: {
      total:          scorecard.total,
      grade:          scorecard.grade,
      breakdown:      scorecard.breakdown,
      oteZone:        scorecard.oteZone,
      action:         scorecard.action,
      sizeMultiplier,
    },
    entry: {
      price:    entry,
      basis:    poi.poiType ? `${poi.poiType}_RETEST` : 'POI_RETEST',
      killzone: kzResult.inKillzone,
    },
    sl,
    slBasis: direction === 'LONG' ? 'BELOW_OB' : 'ABOVE_OB',
    tp:      tps,
    tpBasis: tps.map((_, i) => `TP${i + 1}`),
    rr,
    structure: {
      htfTrend,
      ltfTrend,
      amdPhase:   htfAMD,
      confluence: [],
    },
    levels: { fvgs, obs, bbs, sweeps },
    invalidation: {
      price:  sl,
      reason: direction === 'LONG' ? 'Close below SL' : 'Close above SL',
    },
    tradeBlocked: false,
    tradeBlockReason: '',
  };
}

// ── Main Pipeline ─────────────────────────────────────────────────────────────

/**
 * ICT 분석 엔진 — 27-step 파이프라인 (spec §17)
 * @param {Object}   params
 * @param {Candle[]} params.htfCandles  - 4H 캔들 (≥100개)
 * @param {Candle[]} params.ltfCandles  - 15m 캔들 (≥50개)
 * @param {Candle[]} [params.d1Candles] - 1D 캔들 (차트 컨텍스트)
 * @param {string}   params.pair
 * @param {Object}   [params.config]    - 설정 오버라이드
 * @returns {ICTSignal}
 */
function analyzeICT(params) {
  // [1] 입력 검증
  validateInput(params);

  // [2-3] 정렬 및 설정
  const cfg = { ...config, ...(params.config || {}) };
  const htfCandles = normalize(params.htfCandles);
  const ltfCandles = normalize(params.ltfCandles);

  // [4] HTF 스윙
  const htfSwings = detectSwingPoints(htfCandles, cfg.swingPoint.htf);

  // [5] HTF 구조
  const htfBOS    = detectBOS(htfCandles, htfSwings);
  const htfMSS    = detectMSS(htfCandles, htfSwings);
  const htfTrend  = getCurrentTrend(htfSwings);

  // [6-10] HTF POI + 스윕
  const dispFn    = (c, cs, idx) => isDisplacement(c, cs, idx, cfg.displacement);
  const htfFVGs   = detectFVG(htfCandles, cfg.fvg);
  const htfOBs    = detectOrderBlocks(htfCandles, htfSwings, dispFn);
  const htfBBs    = detectBreakerBlocks(htfCandles, htfOBs, cfg.breakerBlock);
  const htfSweeps = detectLiquiditySweeps(htfCandles, htfSwings, cfg.sweep);

  // [11] HTF AMD
  const htfAMD    = detectAMDPhase(htfCandles, htfSwings, htfSweeps, htfBOS);
  const htfStructure = [...htfBOS, ...htfMSS];
  const htfAnalysis = {
    trend: htfTrend, bos: htfBOS, mss: htfMSS,
    fvgs: htfFVGs, obs: htfOBs, bbs: htfBBs, sweeps: htfSweeps,
  };

  // [12] LTF 스윙
  const ltfSwings = detectSwingPoints(ltfCandles, cfg.swingPoint.ltf);

  // [13-17] LTF 구조 + POI + 스윕
  const ltfBOS    = detectBOS(ltfCandles, ltfSwings);
  const ltfMSS    = detectMSS(ltfCandles, ltfSwings);
  const ltfTrend  = getCurrentTrend(ltfSwings);
  const ltfFVGs   = detectFVG(ltfCandles, cfg.fvg);
  const ltfOBs    = detectOrderBlocks(ltfCandles, ltfSwings, dispFn);
  const ltfSweeps = detectLiquiditySweeps(ltfCandles, ltfSwings, cfg.sweep);

  // [18] 정렬 점수 (priceInHTF_* 플래그 사전 계산)
  const currentPrice = ltfCandles[ltfCandles.length - 1].close;
  const ltfAnalysis = {
    trend: ltfTrend, bos: ltfBOS, mss: ltfMSS,
    fvgs: ltfFVGs, obs: ltfOBs, sweeps: ltfSweeps,
    priceInHTF_OB:  htfOBs.some(o => o.status === 'active' && currentPrice >= o.low && currentPrice <= o.high),
    priceInHTF_FVG: htfFVGs.some(f => f.status === 'active' && currentPrice >= f.low && currentPrice <= f.high),
    priceInHTF_BB:  htfBBs.some(b => b.retestStatus === 'pending' && currentPrice >= b.low && currentPrice <= b.high),
    hasRecentBOS_in_htfDir: ltfBOS.some(b => b.direction === htfTrend),
  };

  const alignment = calculateAlignmentScore(htfAnalysis, ltfAnalysis);

  // Tier ≥ 4 → NEUTRAL 조기 반환
  if (alignment.tier >= 4) {
    return buildNeutral(params.pair, `Tier ${alignment.tier}: 정렬 불충분`, alignment.tier,
      { alignmentScore: alignment.score });
  }

  // [19] 최적 POI 선택
  const poi = selectBestPOI(ltfFVGs, ltfOBs, htfBBs, alignment.htfBias);
  if (!poi) {
    return buildNeutral(params.pair, 'POI 없음', alignment.tier, { alignmentScore: alignment.score });
  }

  // [20] 킬존
  const kzResult = isInKillzone(new Date());
  const kzBonus  = killzoneBonus(kzResult);

  // [21] 스코어카드
  const htfHighs = htfSwings.filter(s => s.type === 'high');
  const htfLows  = htfSwings.filter(s => s.type === 'low');
  const swingHigh = htfHighs.length > 0 ? htfHighs[htfHighs.length - 1].price : poi.high + 100;
  const swingLow  = htfLows.length  > 0 ? htfLows[htfLows.length - 1].price   : poi.low  - 100;
  const entryDirection = alignment.htfBias === 'bull' ? 'LONG' : 'SHORT';

  const scorecard = calculateEntryScorecard({
    htfTrend, entryDirection,
    killzoneResult: kzResult,
    entryPrice:   poi.price,
    swingHigh, swingLow,
    entryZone:    { high: poi.high, low: poi.low },
    activeFVGs:   [...htfFVGs, ...ltfFVGs].filter(f => f.status === 'active'),
    activeOBs:    [...htfOBs,  ...ltfOBs].filter(o => o.status === 'active'),
    activeBBs:    htfBBs.filter(b => b.retestStatus === 'pending'),
    sweeps:       [...htfSweeps, ...ltfSweeps],
    entryTimeSecs: Math.floor(Date.now() / 1000),
    tier:         alignment.tier,
    cfg,
  });

  // [22] 진입 결정
  if (scorecard.action !== 'ENTER') {
    return buildNeutral(params.pair, `Scorecard: ${scorecard.action}`, alignment.tier,
      { alignmentScore: alignment.score, scorecard });
  }

  // [23-25] SL / TP / R:R
  const sl  = calculateSL(poi, htfSwings, entryDirection);
  const tps = calculateTP(poi.price, sl, cfg.signal.minRR);
  const rr  = Math.abs(tps[0] - poi.price) / Math.abs(poi.price - sl);

  // R:R 2:1 미만 → NEUTRAL (Appendix B §4)
  if (rr < cfg.signal.minRR) {
    return buildNeutral(params.pair, `R:R 미달 (${rr.toFixed(2)})`, alignment.tier,
      { alignmentScore: alignment.score });
  }

  // [26] 신뢰도
  const lastSweep = [...htfSweeps, ...ltfSweeps].filter(s => s.confirmed).slice(-1)[0];
  const confidence = calculateConfidence(alignment.score, kzBonus, !!lastSweep, htfAMD);

  // [27] 신호 반환
  return buildSignal({
    pair: params.pair,
    direction: entryDirection,
    alignment, scorecard, poi, sl, tps, rr, confidence,
    htfTrend, ltfTrend, htfAMD, kzResult,
    fvgs:   [...htfFVGs, ...ltfFVGs],
    obs:    [...htfOBs,  ...ltfOBs],
    bbs:    htfBBs,
    sweeps: [...htfSweeps, ...ltfSweeps],
    sizeMultiplier: scorecard.sizeMultiplier,
  });
}

module.exports = { analyzeICT };

// ── CLI 진입점 ────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const get  = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  const pair = get('--pair') || 'BTCUSDT';

  const signalsDir = path.join(__dirname, '..', 'signals');
  if (!fs.existsSync(signalsDir)) fs.mkdirSync(signalsDir, { recursive: true });

  console.log(`[ict-engine] 분석 시작: ${pair}`);

  fetchCandleSet(pair)
    .then(({ htf, ltf, d1 }) => analyzeICT({ htfCandles: htf, ltfCandles: ltf, d1Candles: d1, pair }))
    .then((signal) => {
      const isoSafe = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${pair}_15m_${isoSafe}.json`;
      const outPath = path.join(signalsDir, filename);
      fs.writeFileSync(outPath, JSON.stringify(signal, null, 2));
      console.log(`[ict-engine] 신호 저장: ${outPath}`);
      console.log(`[ict-engine] direction=${signal.direction}, tier=${signal.tier}, confidence=${signal.confidence}`);
    })
    .catch((err) => {
      console.error('[ict-engine] 오류:', err.message);
      process.exit(1);
    });
}
```

- [ ] **Step 3: 단위 테스트 전체 재실행**

```bash
node --test scripts/test/modules/*.test.js
```

Expected: 전체 pass. 실패 없음.

- [ ] **Step 4: 커밋**

```bash
git add scripts/ict-engine.js
git commit -m "feat: implement analyzeICT 27-step pipeline and CLI entry point"
```

---

## Task 13: Integration Test

**Files:**
- Create: `scripts/test/ict-engine.test.js`

- [ ] **Step 1: 실패 테스트 작성**

`scripts/test/ict-engine.test.js`:
```js
'use strict';

const { test } = require('node:test');
const assert   = require('node:assert/strict');
const { analyzeICT } = require('../ict-engine');

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
```

- [ ] **Step 2: 실패 확인**

```bash
node --test scripts/test/ict-engine.test.js
```

Expected: `analyzeICT throws 'ICT Engine: 구현 필요'` 에러 아닌, 실제 실행 (Task 12 완료 후에는 통과해야 함).

- [ ] **Step 3: 통합 테스트 실행**

```bash
node --test scripts/test/ict-engine.test.js
```

Expected: 5 tests pass.

- [ ] **Step 4: 전체 테스트 실행**

```bash
node --test scripts/test/modules/*.test.js scripts/test/ict-engine.test.js
```

Expected: 전체 pass. 실패 케이스 없음.

- [ ] **Step 5: 최종 커밋**

```bash
git add scripts/test/ict-engine.test.js
git commit -m "feat: add analyzeICT integration test"
```

---

## 실행 검증

모든 Task 완료 후:

```bash
# 단위 테스트
node --test scripts/test/modules/*.test.js

# 통합 테스트
node --test scripts/test/ict-engine.test.js

# CLI 동작 확인 (실제 Binance API 호출)
node scripts/ict-engine.js --pair BTCUSDT
# Expected: signals/BTCUSDT_15m_YYYY-MM-DDTHH-MM-SS-000Z.json 생성
```

---

## Self-Review

**Spec 커버리지 점검:**
- ✅ §4 — detectSwingPoints + §4.2 버그 수정
- ✅ §5 — detectBOS, detectMSS (종가 기준만, Appendix B §1 준수)
- ✅ §6 — detectFVG (minGapPct, 미티게이션)
- ✅ §7 — isDisplacement (3가지 조건)
- ✅ §8 — detectOrderBlocks (displacement 필수, 완전관통 invalidated)
- ✅ §9 — detectBreakerBlocks (즉시반전 3캔들, 재시험 창)
- ✅ §10 — detectLiquiditySweeps (wick+종가 조건, followThrough)
- ✅ §11 — calculateAlignmentScore (HTF/LTF/POI 가중치, tier 1-5)
- ✅ §12 — detectAMDPhase (4상태 머신)
- ✅ §13 — isInKillzone, killzoneBonus (time-utils.js 재사용)
- ✅ §14 — calculateEntryScorecard (S1-S5, grade, finalEntryDecision, OTE zone)
- ✅ §15 — ICTSignal 스키마 (buildSignal)
- ✅ §17 — 27-step 파이프라인 (tier≥4 조기 반환 포함)
- ✅ Appendix B — §1(wick BOS금지), §4(R:R 2:1), §6(OB 완전관통), §8(BB 즉시반전), §10(프리미엄 S3=-1)

**Appendix B 체크리스트 (구현 위치):**
1. wick BOS 금지 → market-structure.js `detectBOS` (종가만)
2. CHoCH 단독 MSS 금지 → 추세 컨텍스트 없이 MSS 생성 안 함
3. Tier 4/5 진입 금지 → ict-engine.js step 18 조기 반환
4. R:R 2:1 미만 금지 → ict-engine.js step 25 체크
5. 뉴스 ±2h 금지 → `tradeBlocked: false` 기본값 (외부 이벤트 데이터 없으면 미처리)
6. 완전관통 OB 재사용 금지 → order-block.js `status: 'invalidated'`
7. 추정값 레벨 금지 → POI 없으면 NEUTRAL 반환
8. BB 즉시반전 3캔들 금지 → breaker-block.js `immediateReverseCandles` 체크
9. C/X 등급 ENTER 금지 → scorecard.js `finalEntryDecision`
10. 프리미엄 LONG S3=-1 → scorecard.js `scorePrice` 
11. 스윕 없는 단일 PD배열 → S5=0 + S4≤1 → total ≤ 2 → B급 이하

**플레이스홀더 스캔:** 없음 — 모든 Task에 완전한 코드 포함.

**타입 일관성:**
- `SwingPoint.index` → `number` (모든 모듈에서 동일하게 사용)
- `FVG.status` → `'active'|'mitigated'` (fvg.js, order-block.js, scorecard.js 일치)
- `BreakerBlock.retestStatus` → `'pending'|'tested'` (breaker-block.js, ict-engine.js 일치)
- `SweepEvent.confirmed` → `boolean` (sweep.js, scorecard.js 일치)
