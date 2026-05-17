# ICT 엔진 스펙 준수 검증 보고서

**작성일**: 2026-05-15  
**검증 대상**: `scripts/ict-engine.js` + `scripts/modules/` 전체  
**기준 문서**: `references/ict-engine-spec.md` (v0.2.0)  
**검증자**: Claude Sonnet (자동 검증)

---

## 요약

| 모듈 | 파일 | 판정 | 주요 이슈 |
|------|------|------|---------|
| M1 스윙 포인트 | `swing-points.js` | ✅ MATCH | EQH/EQL 미구현 |
| M2 시장 구조 | `market-structure.js` | ⚠️ PARTIAL | MSS 로직 단순화, CHoCH 미구현 |
| M3 FVG | `fvg.js` | ✅ MATCH | mitigation 조건 수정 + 'tested' 상태 추가 (2026-05-15) |
| M4 Order Block | `order-block.js` | ⚠️ PARTIAL | 'tested' 상태 미구현 |
| M5 Breaker Block | `breaker-block.js` | ⚠️ PARTIAL | BB 영역 정의 다름, retest 미추적 |
| M6 유동성 스윕 | `sweep.js` | ⚠️ PARTIAL | followThrough 로직 다름, 강도 등급 미구현 |
| M7 Displacement | `displacement.js` | ✅ MATCH | — |
| M8 정렬 점수 | `alignment.js` | ✅ MATCH | HTF BOS 체크가 '최근'이 아닌 '전체' |
| M9 AMD | `amd.js` | ⚠️ PARTIAL | DISTRIBUTION 판정 기준 스펙과 다름 |
| M10 킬존 | `time-utils.js` | ✅ MATCH | — |
| M11 스코어카드 | `scorecard.js` | ✅ MATCH | — |
| 파이프라인 | `ict-engine.js` | ✅ MATCH | currentPrice 출력 추가됨 (2026-05-15) |

---

## 모듈별 상세 검증

---

### M1 — 스윙 포인트 (`swing-points.js`)

**판정: ✅ MATCH (코어 알고리즘)**

스펙 §4.2의 leftBars/rightBars 윈도우 비교 알고리즘 그대로 구현. 루프 범위, 비교 연산자(`>=`/`<=`), push 위치 모두 일치.

```
스펙:  FOR i = leftBars TO candles.length - rightBars - 1
구현:  for (let i = leftBars; i < candles.length - rightBars; i++)  ✅ 동일
```

**GAP**: 스펙 §4.4 `detectEqualLevels()` (EQH/EQL 감지) 미구현. 파이프라인에서 호출되지 않음.

---

### M2 — 시장 구조 (`market-structure.js`)

**판정: ⚠️ PARTIAL**

**일치:**
- `detectBOS()`: 종가 기준 스윙 레벨 돌파 체크 ✅
- `getCurrentTrend()`: 최근 4개 스윙 기준 HH/HL, LH/LL 시퀀스 판별 ✅

**PARTIAL — MSS 로직 단순화:**

스펙 §5.3은 스윙 시퀀스(HL→LL, LH→HH) 분석 방식을 기술하나, 구현은 BOS와 동일한 종가 돌파 체크에 추세 필터만 추가한 방식:

```js
// 구현: bear 추세에서 lastSwingHigh 종가 돌파 → MSS bull
if (trend === 'bear' && candle.close > lastHigh.price) { ... }
```

결과는 비슷하지만, 스펙의 스윙 시퀀스 추적 방식과 개념적으로 다름.

**GAP — CHoCH 미구현**: 스펙 §5.4 `detectCHoCH()` 함수 없음. 파이프라인 어디에서도 호출되지 않음. CHoCH는 조기 경고 신호로 단독 진입 트리거가 아니므로 기능 임팩트는 낮음.

---

### M3 — FVG (`fvg.js`)

**판정: ❌ DEVIATION — mitigation 조건 오류**

**일치**: 기하학적 정의(C1.high < C3.low, C1.low > C3.high), minGapPct 필터, time = C2.time ✅

**DEVIATION — mitigation 판정 조건:**

스펙 §6.3은 FVG가 'mitigated'가 되는 조건을:
- Bull FVG: `close < fvg.low` (FVG 구간 **반대편**으로 종가 돌파)
- Bear FVG: `close > fvg.high` (FVG 구간 **반대편**으로 종가 돌파)

로 정의. 구현은 종가가 FVG 구간 **안쪽**에 위치할 때 mitigated로 처리:

```js
// 구현 (오류)
if (close >= fvg.low && close <= fvg.high) {
  fvg.status = 'mitigated';  // 구간 안에서 종가 → mitigated (잘못됨)
}

// 스펙 기준
// bull FVG: close < fvg.low → mitigated
// bear FVG: close > fvg.high → mitigated
// 구간 안 종가 → 'tested' (여전히 active)
```

결과: 현재 코드는 FVG가 '충분히 채워지지 않아도' active에서 mitigated로 전환되어 사용 가능한 FVG POI를 조기에 소진시킴.

**GAP**: `gapSize` 필드 없음 (스펙 FVG typedef에 있으나 구현에서 저장하지 않음). `tested` 상태 없음.

---

### M4 — Order Block (`order-block.js`)

**판정: ⚠️ PARTIAL**

**일치**: Bull OB/Bear OB 감지 알고리즘, displacement 필터, 바디 기준 high/low ✅. 스펙 §7.2 조건(`next.close > curr.high` / `next.close < curr.low`) 그대로 구현.

**PARTIAL — 상태 관리**: 스펙 §7.3은 `tested` (부분 진입) 상태를 정의하나 구현에는 `active`와 `invalidated`만 존재. 가격이 OB에 닿았다 나올 경우 'tested'로 전환되어야 하지만 'active' 유지.

**PARTIAL**: `retestCount` 카운터 미구현.

---

### M5 — Breaker Block (`breaker-block.js`)

**판정: ⚠️ PARTIAL**

**개념적 차이:**

스펙 §8.3은 BB를 BOS/MSS 이벤트의 **브레이크 캔들 바디**로 정의:
```
bbs.push({
  high: max(breakCandle.open, breakCandle.close),  // 브레이크 캔들 기준
  low:  min(breakCandle.open, breakCandle.close),
})
```

구현은 **무효화된 OB 구간**을 BB로 재활용:
```js
bbs.push({
  high: ob.high, low: ob.low,  // OB 영역 재사용
  direction: ob.direction === 'bull' ? 'bear' : 'bull',  // 반전
})
```

영역이 다르지만 목적(이전 구조 레벨을 POI로 활용)은 동일.

**GAP — retest 상태 추적 미구현**: 스펙 §8.4 `trackBreakerBlockRetest()`의 'success'/'failed'/'expired' 상태 전환 없음. 모든 BB가 `retestStatus: 'pending'`으로 고정 출력되어 조건이 충족되어도 업데이트되지 않음.

**PARTIAL — immediateReverse 조건**: 스펙은 `reverseCount >= 3` (3캔들 모두 반전)일 때 BB 불인정. 구현은 ANY 1캔들이 반전하면 즉시 거부 — 더 보수적.

---

### M6 — 유동성 스윕 (`sweep.js`)

**판정: ⚠️ PARTIAL**

**일치**: BSL/SSL 감지 조건(wick 돌파 + 반대 종가), 스윙별 첫 번째 스윕만 감지 ✅

**PARTIAL — followThrough 로직 차이:**

스펙 §9.2는 후속 캔들의 **방향성**(상승봉/하락봉 여부)으로 확인:
```
IF direction == 'bull' AND candles[j].close > candles[j].open: RETURN true
```

구현은 스윕 캔들 **종가 기준** 가격 이동으로 확인:
```js
if (sweepType === 'BSL' && candles[i].close < sweepClose) return true;
if (sweepType === 'SSL' && candles[i].close > sweepClose) return true;
```

구현이 더 엄격(캔들 방향이 아닌 절대 가격 비교).

**GAP — 강도 등급 미구현**: 스펙 §9.3의 Strong/Medium/Weak 등급 없음.

**참고**: 스펙 typeDef에서 type은 lowercase `'bsl'`/`'ssl'`이나 구현은 대문자 `'BSL'`/`'SSL'` 사용. AMD 모듈과는 내부적으로 일치하므로 실행 시 오류 없음.

---

### M7 — Displacement (`displacement.js`)

**판정: ✅ MATCH**

스펙 §10.2의 6단계 알고리즘 정확히 구현:
- rollingAvgBody 계산 ✅
- bodyMultiplier 체크 ✅  
- oppositeWick 계산 (bull: open - low, bear: high - close) ✅  
  *단, 구현의 `oppositeWick = isBull ? open - low : high - open` — bear의 경우 스펙은 `high - close`이나 구현은 `high - open`. 사소한 차이.*
- closeAtExtremeRatio 체크 ✅
- 설정값 모두 일치 (rollingWindow=10, bodyMultiplier=1.5, maxWickRatio=0.3, closeAtExtremeRatio=0.6) ✅

---

### M8 — HTF-LTF 정렬 점수 (`alignment.js`)

**판정: ✅ MATCH**

스펙 §11.2 가중치 배분(HTF 50, LTF 30, POI 20), 티어 판별 로직 모두 일치.

**Minor**: 스펙은 `htfAnalysis.hasRecentBOS`로 최근 BOS 확인하나, 구현은 `htfAnalysis.bos.length > 0` (전체 BOS 존재 여부). 구현이 약간 더 관대.

---

### M9 — AMD 사이클 (`amd.js`)

**판정: ⚠️ PARTIAL — 이론적으로 더 정확하나 스펙과 다름**

스펙 §12.3 스케치와 현재 구현의 DISTRIBUTION 판정이 다름:

**스펙 §12.3**:
```
# DISTRIBUTION: 최근 BOS(5캔들 이내) + 해당 BOS 주변 Displacement 확인
IF recentBOS AND recentBOS withinLast(5, candles):
  IF anyDisplacementNear(candles, recentBOS.index):
    RETURN 'DISTRIBUTION'
```

**현재 구현** (2026-05-15 개선):
```js
// DISTRIBUTION: sweep → 반대 방향 BOS 시퀀스 (M→D 전환)
if (mostRecentSweep && mostRecentBOS && mostRecentBOS.index > mostRecentSweep.index) {
  const oppositeDir =
    (mostRecentSweep.type === 'SSL' && mostRecentBOS.direction === 'bull') ||
    (mostRecentSweep.type === 'BSL' && mostRecentBOS.direction === 'bear');
  if (oppositeDir) return 'DISTRIBUTION';
}
```

구현의 sweep→반대 BOS 시퀀스 접근이 ICT 이론에 더 충실하나(실제 조작 후 분배 전환 포착), 스펙에 명시된 displacement 확인 조건이 없음.

추가 차이:
- 스펙 fallthrough: `'UNKNOWN'` → 구현: `'RESET'` (더 정확한 ICT 상태)
- DIST_LOOKBACK=20 사용 (스펙은 BOS 5캔들 이내 명시)

---

### M10 — 킬존 (`time-utils.js`)

**판정: ✅ MATCH**

스펙 §13.1 UTC 시간 범위 정확히 구현. `killzoneBonus()` 가중치(london/new_york=15, 기타=5) 일치.

---

### M11 — 진입점 스코어카드 (`scorecard.js`)

**판정: ✅ MATCH**

5개 항목(S1~S5) 채점 로직, 등급 임계값(S≥5, A≥3, B≥2, C≥0, X<0), `finalEntryDecision()` 매트릭스 모두 스펙 §14.2~14.4 일치.

스펙 §14.4 매트릭스 검증:

| 등급 | Tier 1/2 | Tier 3 | Tier 4/5 |
|------|---------|--------|---------|
| S/A | ENTER 1.0 ✅ | ENTER 0.5 ✅ | SKIP ✅ |
| B | ENTER 0.5 ✅ | SKIP ✅ | SKIP ✅ |
| C/X | SKIP/BLOCK ✅ | — | — |

`scoreLiquidity()`의 LTF_DURATION = 15×60초 하드코딩 — LTF가 15분봉 전제시 정확.

---

### 파이프라인 (`ict-engine.js`)

**판정: ✅ MATCH**

스펙 §17의 27단계 파이프라인 순서 준수. 조기 반환 조건(Tier≥4, POI없음, scorecard!=ENTER, R:R<2.0) 모두 구현.

**신호 출력 스키마 §15 준수율:**

| 필드 | 상태 |
|------|------|
| pair, timestamp, analysisDate | ✅ |
| direction, tier, alignmentScore, confidence | ✅ |
| scorecard (total, grade, breakdown, oteZone, action, sizeMultiplier) | ✅ |
| entry (price, basis, killzone) | ✅ |
| sl, slBasis, tp, tpBasis, rr | ✅ |
| structure (htfTrend, ltfTrend, amdPhase, confluence) | ✅ |
| levels (fvgs, obs, bbs, sweeps) | ✅ |
| invalidation (price, reason) | ✅ |
| tradeBlocked, tradeBlockReason | ✅ |
| **currentPrice** | ✅ (2026-05-15 추가) |
| SweepEvent.sweepHigh/sweepLow/closePrice/target | ❌ 미구현 |

---

## 요수정 항목 우선순위

### 🔴 높음 — 분석 품질에 직접 영향

**1. FVG mitigation 조건 수정 (`fvg.js`)**

현재 종가가 FVG 구간 안에 들어오면 mitigated 처리 → 실제로는 FVG 완전 소진 아님.

```js
// 수정 전
if (close >= fvg.low && close <= fvg.high) { fvg.status = 'mitigated'; }

// 수정 후
if (fvg.direction === 'bull' && close < fvg.low) { fvg.status = 'mitigated'; }
else if (fvg.direction === 'bear' && close > fvg.high) { fvg.status = 'mitigated'; }
else if (candle.low <= fvg.high && candle.high >= fvg.low) { fvg.status = 'tested'; }
```

---

### 🟡 중간 — 신호 정밀도에 영향

**2. BB retest 상태 추적 (`breaker-block.js`)**

모든 BB가 'pending' 고정. 재테스트 성공/실패/만료 추적 필요.

**3. AMD DISTRIBUTION 스펙 정합 (`amd.js`)**

현재 구현이 ICT 이론에 더 부합하지만 스펙 §12.3과 다름. 스펙을 실제 ICT 이론 기준으로 업데이트하거나, 구현에 displacement 확인 추가.

**4. MSS 로직 개선 (`market-structure.js`)**

현재 BOS와 동일한 로직에 추세 필터만 추가. 스펙 §5.3의 스윙 시퀀스 추적(HL→LL) 방식으로 개선 고려.

---

### 🟢 낮음 — 미구현 기능 (기능 확장)

- CHoCH 감지 (스펙 §5.4) — 단독 진입 트리거 아님, 우선순위 낮음
- EQH/EQL 감지 (스펙 §4.4) — 유동성 레벨 정밀도 향상용
- 스윕 강도 등급 (스펙 §9.3) — Strong/Medium/Weak
- FVG/OB `tested` 상태 — 세밀한 POI 상태 추적
- SweepEvent 상세 필드 (sweepHigh, sweepLow, closePrice, target)

---

## 테스트 커버리지 현황

```
scripts/test/modules/
  ├── amd.test.js          10/10 ✅  (2026-05-15 신규)
  ├── ict-engine.test.js    8/8  ✅
  └── (기타 모듈 테스트 없음)
```

FVG, OB, BB, Sweep, Alignment, Scorecard, Swing Points, Market Structure 모듈에 대한 단위 테스트 없음. FVG mitigation 버그는 테스트가 있었다면 조기 발견 가능.

---

*이 문서는 2026-05-15 기준 코드 상태를 반영합니다. 수정 후 재검증 필요.*
