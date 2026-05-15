# ICT Engine Implementation Design

**Date:** 2026-05-15  
**Spec Reference:** `references/ict-engine-spec.md` v0.2.0  
**Status:** Approved

---

## Context

`scripts/ict-engine.js`는 현재 `analyzeICT()`가 `throw new Error('구현 필요')`만 반환하는 스텁 상태다. `references/ict-engine-spec.md`에 11개 모듈 알고리즘과 27-step 통합 파이프라인이 명세되어 있으며, 이를 구현하는 것이 목표다.

대시보드(`dashboard-server.js`)는 `POST /api/analyze`로 엔진을 서브프로세스로 스폰하고, `signals/*.json`을 읽어 UI에 표시한다. `signal-judge.js`가 엔진 출력을 필터링하는 다운스트림 소비자다.

---

## Decisions

| 항목 | 결정 | 이유 |
|------|------|------|
| 모듈 위치 | `scripts/modules/` 신설 | 공용 헬퍼(`utils/`)와 ICT 도메인 로직 격리 |
| 캔들 소스 | `scripts/utils/binance.js` 신설 | `capture.js`는 volume 제거 버그, 범위 분리 |
| 타임프레임 | LTF=15m / HTF=4h 고정 | 실제 트레이딩 설정 기준 |
| 1h, 1d | 차트 컨텍스트 전달만 | ICT 알고리즘 미처리 |
| TDD 범위 | 핵심 모듈 단위테스트 + 통합 1개 | `node:test` 무설치, 회귀 탐지 균형 |

---

## File Structure

```
scripts/
├── ict-engine.js                   # 기존 — analyzeICT 구현 + CLI 진입점
├── utils/
│   ├── candle-utils.js             # 기존 (재사용)
│   ├── time-utils.js               # 기존 — isInKillzone, killzoneBonus 정규 출처
│   ├── logger.js                   # 기존
│   └── binance.js                  # 신설 — fetchKlines, fetchCandleSet
├── modules/
│   ├── swing-points.js             # M1: detectSwingPoints
│   ├── market-structure.js         # M2: detectBOS, detectMSS
│   ├── fvg.js                      # M3: detectFVG
│   ├── order-block.js              # M4: detectOrderBlocks
│   ├── breaker-block.js            # M5: detectBreakerBlocks
│   ├── sweep.js                    # M6: detectLiquiditySweeps
│   ├── displacement.js             # M7: isDisplacement
│   ├── alignment.js                # M8: calculateAlignmentScore
│   ├── amd.js                      # M9: detectAMDPhase
│   └── scorecard.js                # M11: calculateEntryScorecard
└── test/
    ├── ict-engine.test.js          # 통합 (analyzeICT, spec §14.5 예제)
    └── modules/
        ├── swing-points.test.js
        ├── market-structure.test.js
        ├── fvg.test.js
        ├── order-block.test.js
        ├── sweep.test.js
        ├── displacement.test.js
        ├── alignment.test.js
        └── scorecard.test.js
```

M10(Killzone)은 `time-utils.js`에 이미 구현됨 — 별도 모듈 파일 불필요.

---

## Data Flow

```
CLI: node ict-engine.js --pair BTCUSDT --tf 15m
         ↓
    parseArgs() → { pair: 'BTCUSDT', tf: '15m' }
         ↓
    fetchCandleSet(pair)              ← scripts/utils/binance.js
         ↓ GET fapi.binance.com/fapi/v1/klines
    {
      htf: 4h  캔들 300개  → analyzeICT htfCandles
      ltf: 15m 캔들 300개  → analyzeICT ltfCandles
      h1:  1h  캔들 300개  → signal.levels (차트 컨텍스트)
      d1:  1d  캔들 100개  → signal.levels (차트 컨텍스트)
    }
         ↓
    analyzeICT({ htfCandles, ltfCandles, d1Candles, pair })
         ↓ 27-step 파이프라인
    ICTSignal
         ↓
    signals/${pair}_15m_${isoSafe}.json
    (isoSafe: ISO8601에서 ':' '.' → '-')
```

`h1`, `d1` 캔들은 `analyzeICT`에 전달되지만 ICT 알고리즘은 `htfCandles`(4h)와 `ltfCandles`(15m)만 처리한다.

---

## 27-Step Pipeline (ict-engine.js)

```
[1]  validateInput — 최소 캔들 수 검증 (HTF≥100, LTF≥50)
[2]  normalize — candles 정렬 확인 (oldest→newest)
[3]  config merge — { ...defaultConfig, ...params.config }

[4]  htfSwings  = detectSwingPoints(htfCandles, cfg.swingPoint.htf)
[5]  htfBOS     = detectBOS(htfCandles, htfSwings)
[6]  htfMSS     = detectMSS(htfCandles, htfSwings)
[7]  htfFVGs    = detectFVG(htfCandles, cfg.fvg)
[8]  htfOBs     = detectOrderBlocks(htfCandles, htfSwings, isDisplacement)
[9]  htfBBs     = detectBreakerBlocks(htfCandles, htfOBs, cfg.breakerBlock)
[10] htfSweeps  = detectLiquiditySweeps(htfCandles, htfSwings, cfg.sweep)
[11] htfTrend   = deriveTrend(htfBOS, htfMSS)   // ict-engine.js 내부 헬퍼
     htfAMD     = detectAMDPhase(htfCandles, htfSwings)
     htfAnalysis = { swings: htfSwings, bos: htfBOS, mss: htfMSS, trend: htfTrend,
                     fvgs: htfFVGs, obs: htfOBs, bbs: htfBBs, sweeps: htfSweeps }

[12] ltfSwings  = detectSwingPoints(ltfCandles, cfg.swingPoint.ltf)
[13] ltfBOS     = detectBOS(ltfCandles, ltfSwings)
[14] ltfMSS     = detectMSS(ltfCandles, ltfSwings)
[15] ltfFVGs    = detectFVG(ltfCandles, cfg.fvg)
[16] ltfOBs     = detectOrderBlocks(ltfCandles, ltfSwings, isDisplacement)
[17] ltfSweeps  = detectLiquiditySweeps(ltfCandles, ltfSwings, cfg.sweep)
     ltfTrend   = deriveTrend(ltfBOS, ltfMSS)   // ict-engine.js 내부 헬퍼
     ltfAnalysis = { swings: ltfSwings, bos: ltfBOS, mss: ltfMSS, trend: ltfTrend,
                     fvgs: ltfFVGs, obs: ltfOBs, sweeps: ltfSweeps }

[18] alignment  = calculateAlignmentScore(htfAnalysis, ltfAnalysis)
     → tier ≥ 4이면 즉시 NEUTRAL 반환

[19] poi        = selectBestPOI(ltfFVGs, ltfOBs, htfBBs)
     → 우선순위: FVG > OB > BB

[20] kzResult   = isInKillzone(new Date())    ← time-utils
     kzBonus    = killzoneBonus(kzResult)

[21] scorecard  = calculateEntryScorecard({
       htfTrend, ltfTrend, kzResult, poi,
       ltfSwings, ltfSweeps, ltfCandles, cfg.scorecard
     })

[22] decision   = finalEntryDecision(scorecard, cfg.signal)
     → action ≠ 'ENTER'이면 NEUTRAL 반환

[23] sl         = calculateSL(poi, ltfSwings, decision.direction)
[24] tp         = calculateTP(entry, sl, cfg.signal.minRR)
[25] rr         = Math.abs(tp[0] - entry) / Math.abs(entry - sl)

[26] confidence = calculateConfidence(alignment.score, kzBonus, ltfSweeps, htfAMD)

[27] return buildSignal({ pair, direction, alignment, scorecard, poi,
       sl, tp, rr, confidence, htfTrend, ltfTrend, htfAMD,
       fvgs: [...htfFVGs, ...ltfFVGs],
       obs:  [...htfOBs,  ...ltfOBs],
       bbs:  htfBBs, sweeps: [...htfSweeps, ...ltfSweeps]
     })
```

---

## Module Contracts

> **ict-engine.js 내부 private 헬퍼** (별도 모듈 파일 없음):  
> `deriveTrend`, `selectBestPOI`, `finalEntryDecision`, `calculateSL`, `calculateTP`, `calculateConfidence`, `buildSignal`

```js
// M1: swing-points.js
detectSwingPoints(candles, { leftBars, rightBars }) → SwingPoint[]
// 주의: spec §4.2 버그 수정 — swing-low push는 내부 for-j 루프 종료 후

// M2: market-structure.js
detectBOS(candles, swings) → StructureEvent[]
detectMSS(candles, swings) → StructureEvent[]
// BOS 조건: 종가 기준만 (wick 돌파 불인정 — Appendix B §1)

// M3: fvg.js
detectFVG(candles, { minGapPct }) → FVG[]

// M4: order-block.js
detectOrderBlocks(candles, swings, isDisplacementFn) → OrderBlock[]
// Displacement 동반 필수; 완전관통 → status 'invalidated'

// M5: breaker-block.js
detectBreakerBlocks(candles, obs, { retestMinCandles, retestMaxCandles, immediateReverseCandles }) → BreakerBlock[]
// 즉시반전 3캔들 미만 금지 (Appendix B §8)

// M6: sweep.js
detectLiquiditySweeps(candles, swings, { followThroughLookforward }) → SweepEvent[]
// wick 돌파 + 종가 되돌림 모두 충족해야 confirmed

// M7: displacement.js
isDisplacement(candle, candles, endIdx, cfg) → boolean
// bodyMultiplier 미달 또는 maxWickRatio 초과 → false

// M8: alignment.js
calculateAlignmentScore(htfAnalysis, ltfAnalysis) → { score: 0~100, tier: 1~5 }

// M9: amd.js
detectAMDPhase(candles, swings) → 'ACCUMULATION'|'MANIPULATION'|'DISTRIBUTION'|'RESET'

// M11: scorecard.js
calculateEntryScorecard(params) → { total, grade, breakdown, oteZone, action, sizeMultiplier }
// S1:structure(0|1) S2:time(0|1) S3:price(-1|0|0.5|1) S4:pdArray(0|1|2) S5:liquidity(0|1)
// grade: S(≥5) A(≥3) B(≥2) C(≥0) X(<0)
// action: ENTER(grade A이상) SKIP(B/C) BLOCK(X 또는 프리미엄LONG)

// utils/binance.js
fetchKlines(pair, interval, limit, fetchFn?) → Promise<Candle[]>
fetchCandleSet(pair, fetchFn?) → Promise<{ htf, ltf, h1, d1 }>
// fetchFn: 테스트 주입용 (기본: node fetch → Binance fapi)
```

---

## Known Issues to Fix

| 이슈 | 위치 | 처리 |
|------|------|------|
| spec §4.2 swing-low push 버그 | swing-points.js 구현 시 | push를 내부 for-j 루프 밖으로 이동 |
| `signal.js`의 `isInKillzone` 중복 | signal.js | 이 구현 범위 외. 엔진은 `time-utils` 사용 |
| `ict-engine.js` 스텁 line 27 잘못된 import 주석 | `// const { isInKillzone } = require('./signal')` | `./utils/time-utils`로 수정 |

---

## Testing Plan

**실행:**
```bash
node --test scripts/test/modules/*.test.js   # 단위테스트
node --test scripts/test/ict-engine.test.js  # 통합테스트
```

**단위테스트 커버 케이스:**

| 파일 | 핵심 케이스 |
|------|------------|
| swing-points | pivot high 감지, spec §4.2 버그 수정 검증, 경계 캔들 무시 |
| market-structure | wick BOS 불인정, 상승 BOS 생성, CHoCH 단독 MSS 미생성 |
| fvg | 0.1% 미만 갭 무시, bull/bear 방향, 미티게이션 후 status 변경 |
| order-block | displacement 없는 OB 무시, 완전관통 OB invalidated |
| sweep | wick+종가 조건 모두 필요, followThrough 내 되돌림 없으면 unconfirmed |
| displacement | avgBody*1.5 미달 false, maxWickRatio 초과 false |
| alignment | HTF+LTF 정렬 tier 계산, tier 4~5 → NEUTRAL 트리거 |
| scorecard | spec §14.5 trap(total=0,C,SKIP), S-tier(total=6,S,ENTER), 프리미엄LONG BLOCK |

**통합테스트:**
- `analyzeICT`에 spec §14.5 worked example 캔들 데이터 주입
- `fetchFn` 주입으로 Binance 호출 없이 실행
- `direction`, `tier`, `scorecard.grade` 검증

---

## Signal Output Contract

```js
// signals/${pair}_15m_${isoSafe}.json
// isoSafe: new Date().toISOString().replace(/[:.]/g, '-')
// 예: signals/BTCUSDT_15m_2026-05-15T12-30-00-000Z.json

// 대시보드 /api/latest-signal 조회 조건 충족:
// - 파일명에 pair 문자열 포함 ✓
// - 렉시컬 정렬 = 시간 정렬 ✓ (ISO 형식 유지)
```

---

## Appendix B Constraints (구현 시 체크리스트)

1. wick 기반 BOS 금지 — 종가만
2. CHoCH 단독 진입 금지
3. Tier 4/5 진입 금지 — 파이프라인 step 18에서 조기 반환
4. R:R 2:1 미만 신호 출력 금지
5. 뉴스 ±2h 진입 금지 → `tradeBlocked: true`
6. 완전관통 OB 재사용 금지 → status 'invalidated'
7. 추정값 레벨 생성 금지
8. BB 즉시반전 3캔들 미만 생성 금지
9. C/X 등급 ENTER 금지
10. 프리미엄 구간 LONG S3=-1 → BLOCK
11. 스윕 없는 단일 PD배열 진입 금지 (최대 2점 = C급)
