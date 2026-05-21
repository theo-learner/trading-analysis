# Pair Adapter Design

**Date:** 2026-05-21
**Scope:** ICT 파이프라인 (watcher, ict-engine, dashboard-server) — capture.js 제외

## 목적

신규 종목(ZEC, MORPHO 등)을 추가할 때 `trader.json`에 객체 1개만 추가하면 전체 ICT 분석 파이프라인이 자동으로 처리하도록 한다. 코드 변경 없이 종목 추가/제거가 가능한 구조.

## 배경 및 제약

- 기존 4개 페어(BTC/ETH/SOL/HYPE)는 모두 Binance Futures 데이터 사용
- `watcher.js`, `ict-engine.js`, `dashboard-server.js` 셋 다 `trader.json`의 `pairs` 배열을 읽음 — 이미 단일 소스
- `capture.js`(TradingView/Coinglass/Hyblock 스크린샷)는 이번 범위 밖 — 4개 페어 하드코딩 유지
- ZEC, MORPHO는 ICT 분석만 필요, capture 불필요
- `scripts/dashboard/index.html` 라이브 대시보드 탭 동적화는 별도 작업

## Config Schema

`scripts/config/trader.json`의 `pairs` 필드를 `string[]` → `PairConfig[]`로 변경한다.

```json
"pairs": [
  { "symbol": "BTCUSDT",    "exchange": "binance" },
  { "symbol": "ETHUSDT",    "exchange": "binance" },
  { "symbol": "SOLUSDT",    "exchange": "binance" },
  { "symbol": "HYPEUSDT",   "exchange": "binance" },
  { "symbol": "ZECUSDT",    "exchange": "binance", "skipOnError": true },
  { "symbol": "MORPHOUSDT", "exchange": "binance", "skipOnError": true }
]
```

### PairConfig 필드

| 필드 | 타입 | 기본값 | 설명 |
|------|------|--------|------|
| `symbol` | string | (필수) | Binance Futures 심볼 (e.g. `ZECUSDT`) |
| `exchange` | `"binance"` | `"binance"` | 캔들 데이터 소스. 현재 `"binance"`만 지원 |
| `skipOnError` | boolean | `false` | `true`이면 API 에러 시 크래시 없이 skip + 로그. 기존 4개 페어는 생략(=false) |

## 신규 파일: `scripts/utils/pair-config.js`

모든 리더가 사용하는 단일 헬퍼. `string` 포맷 하위 호환 보장.

```js
'use strict';
const traderConfig = require('../config/trader.json');

function normalizePair(p) {
  if (typeof p === 'string') return { symbol: p, exchange: 'binance', skipOnError: false };
  return { exchange: 'binance', skipOnError: false, ...p };
}

function loadPairs() {
  return (traderConfig.pairs || []).map(normalizePair);
}

module.exports = { loadPairs, normalizePair };
```

## 변경 파일

### scripts/watcher.js

```js
// Before
for (const pair of traderConfig.pairs || []) {
  const candles = await fetchCandleSet(pair);
  // ...
}

// After
const { loadPairs } = require('./utils/pair-config');
for (const pairCfg of loadPairs()) {
  try {
    if (pairCfg.exchange !== 'binance') {
      log('⚠️', `${pairCfg.symbol}: exchange '${pairCfg.exchange}' 미지원, skip`);
      continue;
    }
    const candles = await fetchCandleSet(pairCfg.symbol);
    // 이하 pairCfg.symbol을 pair 문자열 자리에 사용
  } catch (err) {
    if (pairCfg.skipOnError) {
      log('⚠️', `${pairCfg.symbol} skip: ${err.message}`);
    } else {
      throw err;
    }
  }
}
```

### scripts/dashboard-server.js

`/analyze-all` 핸들러에서:
```js
// Before
const pairs = traderConfig.pairs || ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'HYPEUSDT'];
pairs.map(async (p) => { /* p는 문자열 */ })

// After
const { loadPairs } = require('./utils/pair-config');
const pairs = loadPairs();
pairs.map(async (pairCfg) => { /* pairCfg.symbol 사용 */ })
```

### scripts/ict-engine.js

CLI 엔트리포인트는 단일 `--pair` 실행만 하므로 **변경 없음**. `traderConfig`는 알림 발송에만 사용하고 페어 루프는 없다.

### scripts/utils/binance.js

변경 없음. `fetchCandleSet(symbol: string)` 시그니처 유지.

## 변경 파일 요약

| 파일 | 변경 규모 |
|------|----------|
| `scripts/config/trader.json` | pairs 포맷 변경 |
| `scripts/utils/pair-config.js` | 신규 (~15줄) |
| `scripts/watcher.js` | ~10줄 |
| `scripts/dashboard-server.js` | ~5줄 |
| `scripts/ict-engine.js` | 변경 없음 |
| `scripts/utils/binance.js` | 변경 없음 |

## 종목 추가 방법 (완성 후)

```json
// trader.json pairs 배열에 추가만 하면 됨
{ "symbol": "XRPUSDT", "exchange": "binance", "skipOnError": true }
```

## 미래 확장

- **Bybit 지원**: `exchange: "bybit"` 추가 시 `watcher.js`에서 `scripts/utils/bybit.js`로 라우팅 (현재 `"binance"` 외 exchange는 skip 처리)
- **capture 연동**: 향후 PairConfig에 `coinalyze_slug`, `coinglass_ticker`, `hyblock_slug` 필드 추가 후 `capture.js` 리팩터링 가능
- **라이브 대시보드 탭**: `dashboard/index.html`이 `/config` API에서 pairs를 읽어 동적 렌더링 (별도 작업)
