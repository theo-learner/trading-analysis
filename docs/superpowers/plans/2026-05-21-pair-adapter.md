# Pair Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `scripts/config/trader.json`에 객체 1개를 추가하는 것만으로 새 종목이 ICT 분석 파이프라인(watcher, dashboard-server)에서 자동으로 처리되도록 한다.

**Architecture:** `pair-config.js` 헬퍼가 trader.json의 pairs 배열을 정규화(string/object 모두 처리)하여 `{ symbol, exchange, skipOnError }` 형태로 반환한다. watcher.js와 dashboard-server.js는 이 헬퍼를 통해 pairs를 읽고, exchange가 `'binance'`가 아닌 페어는 skip한다.

**Tech Stack:** Node.js (내장 모듈만), node:test, node:assert/strict

---

## File Map

| 파일 | 작업 |
|------|------|
| `scripts/utils/pair-config.js` | **신규** — normalizePair, loadPairs |
| `scripts/test/utils/pair-config.test.js` | **신규** — pair-config 유닛 테스트 |
| `scripts/config/trader.json` | **수정** — pairs: string[] → PairConfig[] |
| `scripts/watcher.js` | **수정** — normalizePair 적용, exchange routing |
| `scripts/test/watcher.test.js` | **수정** — exchange routing 테스트 추가 |
| `scripts/dashboard-server.js` | **수정** — normalizePair 적용, .symbol 추출 |

---

## Task 1: pair-config.js 신규 작성

**Files:**
- Create: `scripts/utils/pair-config.js`
- Create: `scripts/test/utils/pair-config.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`scripts/test/utils/pair-config.test.js` 파일을 생성한다:

```js
'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { normalizePair, loadPairs } = require('../../utils/pair-config');

describe('normalizePair()', () => {
  it('문자열을 PairConfig로 정규화한다', () => {
    assert.deepEqual(normalizePair('BTCUSDT'), {
      symbol: 'BTCUSDT',
      exchange: 'binance',
      skipOnError: false,
    });
  });

  it('부분 객체에 기본값을 채운다', () => {
    assert.deepEqual(normalizePair({ symbol: 'ZECUSDT' }), {
      symbol: 'ZECUSDT',
      exchange: 'binance',
      skipOnError: false,
    });
  });

  it('명시된 skipOnError를 보존한다', () => {
    assert.deepEqual(
      normalizePair({ symbol: 'MORPHOUSDT', exchange: 'binance', skipOnError: true }),
      { symbol: 'MORPHOUSDT', exchange: 'binance', skipOnError: true }
    );
  });

  it('명시된 exchange를 보존한다', () => {
    const result = normalizePair({ symbol: 'XYZUSDT', exchange: 'bybit' });
    assert.equal(result.exchange, 'bybit');
  });
});

describe('loadPairs()', () => {
  it('PairConfig 배열을 반환한다', () => {
    const pairs = loadPairs();
    assert.ok(Array.isArray(pairs));
    assert.ok(pairs.length > 0);
    for (const p of pairs) {
      assert.equal(typeof p.symbol, 'string', 'symbol must be string');
      assert.equal(typeof p.exchange, 'string', 'exchange must be string');
      assert.equal(typeof p.skipOnError, 'boolean', 'skipOnError must be boolean');
    }
  });

  it('모든 symbol이 비어있지 않다', () => {
    const pairs = loadPairs();
    for (const p of pairs) {
      assert.ok(p.symbol.length > 0, `empty symbol found`);
    }
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인**

```bash
node --test --test-reporter=spec scripts/test/utils/pair-config.test.js
```

Expected: `Error: Cannot find module '../../utils/pair-config'`

- [ ] **Step 3: pair-config.js 구현**

`scripts/utils/pair-config.js` 파일을 생성한다:

```js
'use strict';

const traderConfig = require('../config/trader.json');

function normalizePair(p) {
  if (typeof p === 'string') {
    return { symbol: p, exchange: 'binance', skipOnError: false };
  }
  return { exchange: 'binance', skipOnError: false, ...p };
}

function loadPairs() {
  return (traderConfig.pairs || []).map(normalizePair);
}

module.exports = { normalizePair, loadPairs };
```

- [ ] **Step 4: 테스트 통과 확인**

```bash
node --test --test-reporter=spec scripts/test/utils/pair-config.test.js
```

Expected: 7개 테스트 모두 PASS

- [ ] **Step 5: 커밋**

```bash
git add scripts/utils/pair-config.js scripts/test/utils/pair-config.test.js
git commit -m "feat(pair-adapter): add pair-config utility with normalizePair/loadPairs"
```

---

## Task 2: trader.json pairs 형식 변경

**Files:**
- Modify: `scripts/config/trader.json`

- [ ] **Step 1: pairs 배열을 객체 배열로 변경**

`scripts/config/trader.json`의 `"pairs"` 필드를 아래처럼 교체한다:

```json
"pairs": [
  { "symbol": "BTCUSDT",    "exchange": "binance" },
  { "symbol": "ETHUSDT",    "exchange": "binance" },
  { "symbol": "SOLUSDT",    "exchange": "binance" },
  { "symbol": "HYPEUSDT",   "exchange": "binance" },
  { "symbol": "ZECUSDT",    "exchange": "binance", "skipOnError": true },
  { "symbol": "MORPHOUSDT", "exchange": "binance", "skipOnError": true }
],
```

- [ ] **Step 2: loadPairs() 테스트 재실행 — 포맷 변경 후도 통과하는지 확인**

```bash
node --test --test-reporter=spec scripts/test/utils/pair-config.test.js
```

Expected: 7개 테스트 모두 PASS (normalizePair가 객체도 처리하므로)

- [ ] **Step 3: 커밋**

```bash
git add scripts/config/trader.json
git commit -m "feat(pair-adapter): migrate trader.json pairs to PairConfig objects, add ZECUSDT/MORPHOUSDT"
```

---

## Task 3: watcher.js exchange routing + 테스트 추가

**Files:**
- Modify: `scripts/watcher.js` (lines 3–32)
- Modify: `scripts/test/watcher.test.js`

- [ ] **Step 1: 실패할 테스트를 watcher.test.js에 추가**

`scripts/test/watcher.test.js`의 마지막 `it(...)` 블록 다음, `describe` 닫는 괄호 앞에 추가한다:

```js
  it('unsupported exchange를 가진 페어를 skip하고 나머지를 처리한다', async () => {
    const fetched = [];
    const warned  = [];
    const deps = makeDeps({
      traderConfig: {
        pairs: [
          { symbol: 'BTCUSDT',  exchange: 'binance', skipOnError: false },
          { symbol: 'XYZUSDT',  exchange: 'bybit',   skipOnError: true  },
          { symbol: 'ETHUSDT',  exchange: 'binance', skipOnError: false },
        ],
      },
      fetchCandleSet: async (symbol) => {
        fetched.push(symbol);
        return { htf: [], ltf: [], h1: [], d1: [] };
      },
      logger: {
        log:  () => {},
        warn: (msg) => warned.push(msg),
      },
    });
    await run(deps);
    assert.deepEqual(fetched, ['BTCUSDT', 'ETHUSDT']);
    assert.ok(warned.some(m => m.includes('XYZUSDT') && m.includes('미지원')));
  });
```

- [ ] **Step 2: 새 테스트가 실패하는지 확인**

```bash
node --test --test-reporter=spec scripts/test/watcher.test.js
```

Expected: 5개 PASS, 1개 FAIL (XYZUSDT가 skip되지 않으므로)

- [ ] **Step 3: watcher.js 수정**

`scripts/watcher.js`의 `run` 함수 시그니처 상단에 require를 추가하고, 루프 내부를 아래로 교체한다.

파일 상단 `'use strict';` 다음 줄에 추가:

```js
const { normalizePair } = require('./utils/pair-config');
```

`run` 함수 내부의 `const work = (async () => { ... })();` 블록 전체(line 14~33)를 아래로 교체한다:

```js
  const work = (async () => {
    for (const rawPair of traderConfig.pairs || []) {
      const pairCfg = normalizePair(rawPair);
      if (pairCfg.exchange !== 'binance') {
        logger.warn(`[watcher] ${pairCfg.symbol}: exchange '${pairCfg.exchange}' 미지원, skip`);
        continue;
      }
      try {
        const candles = await fetchCandleSet(pairCfg.symbol);
        const signal = analyzeICT({
          htfCandles: candles.htf,
          ltfCandles: candles.ltf,
          d1Candles:  candles.d1,
          pair:       pairCfg.symbol,
          config:     ictConfig,
        });
        const result = await notifySignal(signal, traderConfig);
        const sig = `${signal.direction} | Tier${signal.tier} | ${signal.confidence} | RR ${signal.rr?.toFixed(2) ?? '?'} | kz:${signal.entry?.killzone ?? 'none'}`;
        const outcome = result.sent ? '✅ SENT' : `⏭ ${result.skipped}${result.reason ? ' — ' + result.reason : ''}`;
        logger.log(`[watcher] ${pairCfg.symbol}: ${sig} → ${outcome}`);
      } catch (err) {
        logger.warn(`[watcher] ${pairCfg.symbol} failed: ${err.message}`);
      }
    }
  })();
```

- [ ] **Step 4: 전체 watcher 테스트 통과 확인**

```bash
node --test --test-reporter=spec scripts/test/watcher.test.js
```

Expected: 6개 테스트 모두 PASS

기존 테스트는 `traderConfig.pairs`에 문자열 배열을 주입하는데, `normalizePair`가 문자열도 처리하므로 모두 통과해야 한다.

- [ ] **Step 5: 커밋**

```bash
git add scripts/watcher.js scripts/test/watcher.test.js
git commit -m "feat(pair-adapter): watcher uses normalizePair, skips unsupported exchange"
```

---

## Task 4: dashboard-server.js analyze-all 핸들러 수정

**Files:**
- Modify: `scripts/dashboard-server.js` (lines 211–226)

- [ ] **Step 1: dashboard-server.js 수정**

파일 상단 require 블록(line 24~27 근처)에 아래를 추가한다:

```js
const { normalizePair } = require('./utils/pair-config');
```

`/api/analyze-all` 핸들러 내부(line 211부터)를 아래로 교체한다:

```js
    analyzeAllRunning = true;
    try {
      const rawPairs = traderConfig.pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'HYPEUSDT'];
      const pairs = rawPairs.map(normalizePair);
      const deps  = { fetchCandleSet, analyzeICT, buildDiary, diaryDir: DIARY_DIR, signalsDir: SIGNALS_DIR };

      const settled = await Promise.allSettled(
        pairs.map(async (pairCfg) => {
          const result = await buildDiaryEntry(pairCfg.symbol, deps);
          pushSSE('analyze-done', { code: 0, pair: pairCfg.symbol, direction: result.signal?.direction, tier: result.signal?.tier });
          return { pair: pairCfg.symbol, direction: result.signal?.direction, tier: result.signal?.tier, confidence: result.signal?.confidence };
        })
      );

      const results = settled.map((s, i) =>
        s.status === 'fulfilled'
          ? s.value
          : { pair: pairs[i].symbol, error: s.reason?.message || '분석 실패' }
      );
      return jsonResponse(res, { ok: true, results });
    } finally {
      analyzeAllRunning = false;
    }
```

- [ ] **Step 2: dashboard-server 다이어리 테스트 통과 확인**

```bash
node --test --test-reporter=spec scripts/test/dashboard-server.diary.test.js
```

Expected: 모든 테스트 PASS

- [ ] **Step 3: 커밋**

```bash
git add scripts/dashboard-server.js
git commit -m "feat(pair-adapter): dashboard-server analyze-all uses normalizePair"
```

---

## Task 5: 전체 통합 검증

- [ ] **Step 1: 전체 유닛 테스트 실행**

```bash
node --test --test-reporter=spec \
  scripts/test/utils/pair-config.test.js \
  scripts/test/watcher.test.js \
  scripts/test/dashboard-server.diary.test.js
```

Expected: 모든 테스트 PASS

- [ ] **Step 2: watcher 단건 실행 — ZECUSDT가 정상 처리 또는 graceful skip 확인**

```bash
node -e "
const { run } = require('./scripts/watcher');
run({
  traderConfig: { pairs: [{ symbol: 'ZECUSDT', exchange: 'binance', skipOnError: true }] },
  ictConfig: require('./scripts/config/ict-engine.json'),
  notifySignal: async () => ({ sent: false, skipped: 'test' }),
  logger: console,
  timeoutMs: 30000,
}).then(() => console.log('done')).catch(e => console.error(e.message));
"
```

Expected: Binance에서 캔들을 가져와 ICT 분석을 실행하거나, 페어가 없으면 `[watcher] ZECUSDT skip: ...` 로그 출력 후 종료 (crash 없음)

- [ ] **Step 3: 최종 커밋 (필요 시)**

모든 변경이 이전 커밋에 포함됐으면 skip. 남은 변경이 있으면:

```bash
git add -A
git commit -m "feat(pair-adapter): integration verified"
```
