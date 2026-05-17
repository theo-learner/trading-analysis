# ICT Engine Algorithm Specification

**버전**: 0.2.0  
**작성일**: 2026-05-14  
**최종수정**: 2026-05-15 — 모듈 11 진입점 스코어카드 추가  
**대상 파일**: `scripts/ict-engine.js`  
**기반 문서**: `references/20260514-ICT-knowledge-base.md`

---

## 목차

1. [개요](#1-개요)
2. [입력 데이터 계약](#2-입력-데이터-계약)
3. [핵심 데이터 구조](#3-핵심-데이터-구조)
4. [모듈 1 — 스윙 포인트 감지](#4-모듈-1--스윙-포인트-감지)
5. [모듈 2 — 시장 구조 (BOS / MSS / CHoCH)](#5-모듈-2--시장-구조-bos--mss--choch)
6. [모듈 3 — FVG 감지](#6-모듈-3--fvg-감지)
7. [모듈 4 — Order Block 감지](#7-모듈-4--order-block-감지)
8. [모듈 5 — Breaker Block 추적](#8-모듈-5--breaker-block-추적)
9. [모듈 6 — 유동성 스윕 감지](#9-모듈-6--유동성-스윕-감지)
10. [모듈 7 — Displacement 캔들 필터](#10-모듈-7--displacement-캔들-필터)
11. [모듈 8 — HTF-LTF 정렬 점수](#11-모듈-8--htf-ltf-정렬-점수)
12. [모듈 9 — AMD 사이클 상태 머신](#12-모듈-9--amd-사이클-상태-머신)
13. [모듈 10 — Killzone 필터](#13-모듈-10--killzone-필터)
14. [모듈 11 — 진입점 스코어카드](#14-모듈-11--진입점-스코어카드)
15. [신호 출력 스키마](#15-신호-출력-스키마)
16. [무효화 조건](#16-무효화-조건)
17. [통합 파이프라인 흐름](#17-통합-파이프라인-흐름)
18. [설정 상수](#18-설정-상수)

---

## 1. 개요

`ict-engine.js`는 HTF(4H/1D) 캔들 데이터와 LTF(1H/15M) 캔들 데이터를 입력받아, ICT 프레임워크 기반의 구조 분석 → 신호 판별 → 출력 JSON을 생성하는 분석 엔진이다.

**엔진의 책임 범위:**
- 스윙 포인트 감지 및 시장 구조 레이블링
- FVG / OB / Breaker Block 영역 산출
- 유동성 스윕 이벤트 감지
- Displacement 캔들 식별
- HTF-LTF 정렬 점수 계산
- AMD 사이클 현재 단계 판별
- 킬존 필터 적용
- 신호 출력 JSON 생성

**엔진이 하지 않는 것:**
- 주문 실행 (→ `trader.js`)
- R:R 최종 필터링 (→ `signal-judge.js`)
- 차트 캡처 (→ `capture.js`)

---

## 2. 입력 데이터 계약

### 2.1 캔들 배열 (OHLCV)

`_data.txt` 또는 TradingView API에서 수집한 캔들 데이터. 각 캔들은 아래 필드를 가진다.

```js
/**
 * @typedef {Object} Candle
 * @property {number} time       - Unix timestamp (초 단위, UTC)
 * @property {number} open       - 시가
 * @property {number} high       - 고가
 * @property {number} low        - 저가
 * @property {number} close      - 종가
 * @property {number} volume     - 거래량
 */
```

**정렬 방향**: 오래된 캔들 → 최신 캔들 (인덱스 0이 가장 오래됨)

**최소 캔들 수**:
- HTF (4H / 1D): 최소 100개 이상 (스윙 포인트 + 구조 분석용)
- LTF (1H): 최소 50개 이상

### 2.2 엔진 호출 서명

```js
/**
 * ICT 엔진 메인 진입점
 *
 * @param {Object} params
 * @param {Candle[]} params.htfCandles  - 4H 캔들 배열 (기준 HTF)
 * @param {Candle[]} params.ltfCandles  - 1H 캔들 배열 (진입 LTF)
 * @param {Candle[]} [params.d1Candles] - 1D 캔들 배열 (최상위 컨텍스트, 선택)
 * @param {string}   params.pair        - 페어 심볼 (예: 'BTCUSDT')
 * @param {Object}   [params.config]    - 설정 오버라이드 (§17 참조)
 * @returns {ICTSignal}                 - §14 신호 출력 스키마
 */
function analyzeICT(params) { ... }
```

---

## 3. 핵심 데이터 구조

```js
/**
 * 스윙 포인트
 * @typedef {Object} SwingPoint
 * @property {'high'|'low'}  type    - 스윙 고점 / 저점
 * @property {number}        price   - 스윙 가격
 * @property {number}        time    - 캔들 타임스탬프
 * @property {number}        index   - 배열 인덱스
 * @property {'htf'|'ltf'}   tf      - 타임프레임 출처
 */

/**
 * 가격 구간 (FVG, OB, BB 공통 베이스)
 * @typedef {Object} PriceZone
 * @property {number}              high       - 구간 상단
 * @property {number}              low        - 구간 하단
 * @property {number}              time       - 형성 시점 (시작 캔들)
 * @property {'bull'|'bear'}       direction  - 강세/약세 방향
 * @property {'htf'|'ltf'}         tf         - 타임프레임 출처
 * @property {'active'|'mitigated'|'invalidated'} status - 유효 상태
 */

/**
 * @typedef {PriceZone} FVG
 * @property {number} candle1High  - 1번 캔들 고가
 * @property {number} candle3Low   - 3번 캔들 저가 (bullish FVG 기준)
 * @property {number} gapSize      - 구간 크기 (high - low)
 */

/**
 * @typedef {PriceZone} OrderBlock
 * @property {number}  breakoutCandle  - 돌파 캔들 인덱스
 * @property {boolean} volumeConfirmed - 거래량 확인 여부
 */

/**
 * @typedef {PriceZone} BreakerBlock
 * @property {SwingPoint} brokenLevel      - 깨진 스윙 포인트
 * @property {number}     breakCandle      - 돌파 캔들 인덱스
 * @property {number|null} retestCandle    - 재테스트 캔들 인덱스 (미발생시 null)
 * @property {'pending'|'success'|'failed'} retestStatus
 */

/**
 * @typedef {Object} SweepEvent
 * @property {SwingPoint} target       - 스윕 대상 레벨
 * @property {number}     sweepHigh    - 스윕 고점 (wick)
 * @property {number}     sweepLow     - 스윕 저점 (wick)
 * @property {number}     closePrice   - 스윕 캔들 종가
 * @property {number}     time         - 스윕 캔들 타임스탬프
 * @property {'bsl'|'ssl'} type        - BSL 스윕 / SSL 스윕
 * @property {boolean}    confirmed    - 방향성 후속 무브 확인 여부
 */

/**
 * @typedef {Object} StructureEvent
 * @property {'BOS'|'MSS'|'CHoCH'}  type
 * @property {'bull'|'bear'}         direction
 * @property {number}                price       - 돌파된 레벨
 * @property {number}                time
 * @property {number}                index
 * @property {'htf'|'ltf'}           tf
 */
```

---

## 4. 모듈 1 — 스윙 포인트 감지

### 4.1 목적
BOS / MSS / CHoCH / FVG / OB 감지의 기반이 되는 스윙 고점 / 저점을 식별한다.

### 4.2 알고리즘

```
detectSwingPoints(candles, leftBars, rightBars):
  swings = []
  
  FOR i = leftBars TO candles.length - rightBars - 1:
    
    # 스윙 고점 판별
    isHigh = TRUE
    FOR j = i - leftBars TO i + rightBars:
      IF j != i AND candles[j].high >= candles[i].high:
        isHigh = FALSE; BREAK
    IF isHigh:
      swings.push({ type: 'high', price: candles[i].high, ... })
    
    # 스윙 저점 판별
    isLow = TRUE
    FOR j = i - leftBars TO i + rightBars:
      IF j != i AND candles[j].low <= candles[i].low:
        isLow = FALSE; BREAK
      IF isLow:
        swings.push({ type: 'low', price: candles[i].low, ... })
  
  RETURN swings
```

### 4.3 파라미터

| 파라미터 | HTF (4H/1D) | LTF (1H) | 설명 |
|---------|------------|---------|------|
| `leftBars` | 5 | 3 | 왼쪽으로 확인할 캔들 수 |
| `rightBars` | 5 | 3 | 오른쪽으로 확인할 캔들 수 (미래 데이터 필요) |

> **주의**: 실시간 엔진에서는 `rightBars` 만큼 확정 지연이 발생한다. 스윙 포인트는 확인 시점 기준으로 레이블링한다.

### 4.4 Equal Highs / Equal Lows (EQH / EQL)

```
detectEqualLevels(swings, tolerancePct = 0.001):
  equalGroups = []
  FOR i = 0 TO swings.length - 1:
    FOR j = i+1 TO swings.length - 1:
      IF swings[i].type == swings[j].type:
        priceDiff = |swings[i].price - swings[j].price| / swings[i].price
        IF priceDiff <= tolerancePct:
          equalGroups.push({ level: avg(swings[i].price, swings[j].price), count: 2 })
  RETURN equalGroups
```

**EQH/EQL 허용 오차**: 가격 기준 ±0.1% 이내

---

## 5. 모듈 2 — 시장 구조 (BOS / MSS / CHoCH)

### 5.1 개념 구분

| 개념 | 정의 | 판별 기준 |
|------|------|---------|
| **BOS** (Break of Structure) | 이전 스윙 포인트를 캔들 **종가**로 돌파 | 종가 > 이전 스윙 고점 (bull BOS) / 종가 < 이전 스윙 저점 (bear BOS) |
| **MSS** (Market Structure Shift) | 현재 추세의 스윙 시퀀스가 깨짐 | 상승 추세 중 HL이 아닌 LL 형성 / 하락 추세 중 LH가 아닌 HH 형성 |
| **CHoCH** (Change of Character) | 구조 돌파 없이 **행동 특성**이 변화 | 변동성, 캔들 크기, 되돌림 깊이의 통계적 변화 |

### 5.2 BOS 감지

```
detectBOS(candles, swings):
  events = []
  FOR each candle at index i:
    recent_swings = swings filtered by index < i
    
    # Bull BOS: 최근 스윙 고점을 종가로 돌파
    lastSwingHigh = most recent swing.type='high' in recent_swings
    IF lastSwingHigh AND candle.close > lastSwingHigh.price:
      events.push({ type: 'BOS', direction: 'bull', price: lastSwingHigh.price, time: candle.time })
    
    # Bear BOS: 최근 스윙 저점을 종가로 돌파
    lastSwingLow = most recent swing.type='low' in recent_swings
    IF lastSwingLow AND candle.close < lastSwingLow.price:
      events.push({ type: 'BOS', direction: 'bear', price: lastSwingLow.price, time: candle.time })
  
  RETURN events
```

> **필수**: 종가(close) 기준. 고점/저점(wick) 기반 돌파는 BOS로 인정하지 않음.

### 5.3 MSS 감지

```
detectMSS(candles, swings):
  # 스윙 시퀀스 추적: [HH, HL, HH, HL] (상승) vs [LL, LH, LL, LH] (하락)
  sequence = buildSwingSequence(swings)
  events = []
  
  FOR i = 1 TO sequence.length - 1:
    prev = sequence[i-1]
    curr = sequence[i]
    
    # 상승 시퀀스 중 LL 발생 → MSS (bear)
    IF prevTrend == 'bull' AND curr.type == 'low' AND curr.price < prev_HL.price:
      events.push({ type: 'MSS', direction: 'bear', ... })
    
    # 하락 시퀀스 중 HH 발생 → MSS (bull)
    IF prevTrend == 'bear' AND curr.type == 'high' AND curr.price > prev_LH.price:
      events.push({ type: 'MSS', direction: 'bull', ... })
  
  RETURN events
```

### 5.4 CHoCH 감지

CHoCH는 구조 돌파 이전에 발생하는 **행동 특성 변화**이므로 3가지 지표를 조합한다.

```
detectCHoCH(candles, lookback = 10):
  FOR each window of [lookback] candles:
    prev_half = candles[0..lookback/2]
    curr_half = candles[lookback/2..lookback]
    
    # 지표 1: 캔들 바디 크기 변화
    avgBodyPrev = mean(|c.close - c.open| FOR c IN prev_half)
    avgBodyCurr = mean(|c.close - c.open| FOR c IN curr_half)
    bodyChangeRatio = avgBodyCurr / avgBodyPrev
    
    # 지표 2: 되돌림 깊이 변화 (풀백 비율)
    prevPullbackDepth = calc_pullback_depth(prev_half)
    currPullbackDepth = calc_pullback_depth(curr_half)
    
    # 지표 3: 추세 일관성 (같은 방향 캔들 비율)
    prevConsistency = ratio of directional candles in prev_half
    currConsistency = ratio of directional candles in curr_half
    
    # CHoCH 플래그: 3가지 중 2가지 이상 역전
    chochScore = 0
    IF bodyChangeRatio > 1.5 OR bodyChangeRatio < 0.67: chochScore++
    IF |currPullbackDepth - prevPullbackDepth| > 0.15:  chochScore++
    IF |currConsistency - prevConsistency| > 0.3:        chochScore++
    
    IF chochScore >= 2:
      events.push({ type: 'CHoCH', ... })
```

> CHoCH는 조기 경고 신호이며, 단독으로 진입 트리거가 되지 않는다. BOS/MSS의 선행 필터로만 사용한다.

### 5.5 현재 추세 방향 판별

```
getCurrentTrend(swings):
  # 최근 4개 스윙 포인트 기준 시퀀스 분석
  recent = last 4 swings
  highs = recent.filter(s => s.type == 'high')
  lows  = recent.filter(s => s.type == 'low')
  
  IF highs[1].price > highs[0].price AND lows[1].price > lows[0].price:
    RETURN 'bull'   # HH + HL
  ELSE IF highs[1].price < highs[0].price AND lows[1].price < lows[0].price:
    RETURN 'bear'   # LH + LL
  ELSE:
    RETURN 'ranging'
```

---

## 6. 모듈 3 — FVG 감지

### 6.1 기하학적 정의

3개의 연속 캔들 {C1, C2, C3}에서:

```
# Bullish FVG (상승 불균형)
fvgHigh  = C3.low   ← 구간 상단
fvgLow   = C1.high  ← 구간 하단
조건: C1.high < C3.low  (갭이 존재)
      C3이 갭을 완전히 닫지 않음 (C3.close > C1.high)

# Bearish FVG (하락 불균형)
fvgHigh  = C1.low   ← 구간 상단
fvgLow   = C3.high  ← 구간 하단
조건: C1.low > C3.high  (갭이 존재)
      C3이 갭을 완전히 닫지 않음 (C3.close < C1.low)
```

### 6.2 감지 알고리즘

```
detectFVG(candles, minGapPct = 0.001):
  fvgs = []
  
  FOR i = 0 TO candles.length - 3:
    C1 = candles[i]
    C2 = candles[i+1]
    C3 = candles[i+2]
    
    # Bullish FVG
    gap = C3.low - C1.high
    IF gap > 0:
      gapPct = gap / C1.high
      IF gapPct >= minGapPct:
        fvgs.push({
          direction: 'bull',
          high: C3.low,
          low:  C1.high,
          gapSize: gap,
          time: C2.time,   # 중간 캔들 기준
          status: 'active'
        })
    
    # Bearish FVG
    gap = C1.low - C3.high
    IF gap > 0:
      gapPct = gap / C1.low
      IF gapPct >= minGapPct:
        fvgs.push({
          direction: 'bear',
          high: C1.low,
          low:  C3.high,
          gapSize: gap,
          time: C2.time,
          status: 'active'
        })
  
  RETURN fvgs
```

**최소 갭 크기**: 가격 기준 0.1% 이상 (노이즈 필터)

### 6.3 FVG 상태 업데이트

```
updateFVGStatus(fvgs, newCandles):
  FOR each fvg IN fvgs WHERE fvg.status == 'active':
    FOR each candle IN newCandles:
      
      # 가격이 FVG 구간 안으로 진입하면 → mitigation 진행
      IF candle touches fvg zone (low <= fvg.high AND high >= fvg.low):
        
        # 완전 충전: 종가가 FVG 반대편을 돌파
        IF fvg.direction == 'bull' AND candle.close < fvg.low:
          fvg.status = 'mitigated'
        IF fvg.direction == 'bear' AND candle.close > fvg.high:
          fvg.status = 'mitigated'
        ELSE:
          fvg.status = 'tested'  # 부분 충전 (여전히 active)
```

---

## 7. 모듈 4 — Order Block 감지

### 7.1 정의

**Bullish OB**: 큰 상승 무브 직전의 하강 캔들(들)로 구성된 응집 구간  
**Bearish OB**: 큰 하락 무브 직전의 상승 캔들(들)로 구성된 응집 구간

### 7.2 감지 알고리즘

```
detectOrderBlocks(candles, displacementThreshold = 1.5):
  obs = []
  
  FOR i = 1 TO candles.length - 2:
    curr = candles[i]
    next = candles[i+1]
    
    # 다음 캔들이 Displacement인지 확인 (§10 참조)
    IF NOT isDisplacement(next, candles, displacementThreshold):
      CONTINUE
    
    # Bullish OB: 다음 캔들이 큰 상승봉 → 현재 캔들이 하강봉이면 Bullish OB
    IF next.close > next.open AND next.close > curr.high:  # BOS 동반
      IF curr.close < curr.open:  # 현재 캔들이 하강봉
        obs.push({
          direction: 'bull',
          high: max(curr.open, curr.close),  # 바디 기준
          low:  min(curr.open, curr.close),
          time: curr.time,
          breakoutCandle: i+1,
          status: 'active'
        })
    
    # Bearish OB: 다음 캔들이 큰 하락봉 → 현재 캔들이 상승봉이면 Bearish OB
    IF next.close < next.open AND next.close < curr.low:  # BOS 동반
      IF curr.close > curr.open:  # 현재 캔들이 상승봉
        obs.push({
          direction: 'bear',
          high: max(curr.open, curr.close),
          low:  min(curr.open, curr.close),
          time: curr.time,
          breakoutCandle: i+1,
          status: 'active'
        })
  
  RETURN obs
```

### 7.3 OB 상태 업데이트

```
updateOBStatus(obs, newCandles):
  FOR each ob IN obs WHERE ob.status == 'active':
    FOR each candle IN newCandles:
      
      # 가격이 OB 구간 재테스트
      IF candle.low <= ob.high AND candle.high >= ob.low:
        ob.retestCount = (ob.retestCount || 0) + 1
        
        # 완전 관통: 종가가 OB 반대편 돌파 → 무효화
        IF ob.direction == 'bull' AND candle.close < ob.low:
          ob.status = 'invalidated'
        IF ob.direction == 'bear' AND candle.close > ob.high:
          ob.status = 'invalidated'
        ELSE:
          ob.status = 'tested'
```

---

## 8. 모듈 5 — Breaker Block 추적

### 8.1 정의

구조적 레벨(스윙 포인트)을 **Displacement 캔들로 종가 돌파**했을 때, 그 돌파 캔들의 범위가 Breaker Block 구간이 된다.

### 8.2 생성 조건

```
형성 조건 체크리스트:
1. 확립된 스윙 고점/저점이 존재
2. 돌파 캔들이 Displacement 조건을 충족 (§10)
3. 돌파가 종가 기준 (wick만으로는 불가)
4. 돌파 후 최소 3캔들 이상 방향 지속 (즉시 반전 시 Breaker Block 불인정)
```

### 8.3 감지 알고리즘

```
detectBreakerBlocks(candles, swings):
  bbs = []
  
  FOR each BOS/MSS event in structureEvents:
    breakCandle = candles[event.index]
    
    # 즉시 반전 여부 확인 (다음 3캔들 체크)
    reverseCount = 0
    FOR j = event.index+1 TO event.index+3:
      IF candles[j] moves against breakCandle direction: reverseCount++
    IF reverseCount >= 3: CONTINUE  # 즉시 반전 → Breaker Block 불인정
    
    bbs.push({
      direction: event.direction,
      high: max(breakCandle.open, breakCandle.close),
      low:  min(breakCandle.open, breakCandle.close),
      brokenLevel: event.price,
      breakCandle: event.index,
      retestCandle: null,
      retestStatus: 'pending',
      status: 'active'
    })
  
  RETURN bbs
```

### 8.4 재테스트 추적 (핵심 로직)

```
trackBreakerBlockRetest(bbs, newCandle, newIndex):
  FOR each bb IN bbs WHERE bb.retestStatus == 'pending':
    
    # 재테스트 유효 윈도우: 형성 후 5 ~ 20 캔들 이내
    candlesSinceBreak = newIndex - bb.breakCandle
    IF candlesSinceBreak < 5 OR candlesSinceBreak > 20:
      IF candlesSinceBreak > 20: bb.retestStatus = 'expired'
      CONTINUE
    
    # 재테스트: 가격이 BB 구간에 닿음
    IF newCandle.high >= bb.low AND newCandle.low <= bb.high:
      bb.retestCandle = newIndex
      
      # ─────────────────────────────────────────────────────
      # 성공 조건: 종가가 BB 구간 밖에서 마감 (wick만 진입)
      # 실패(무효화) 조건: 종가가 BB 구간을 완전히 통과
      # ─────────────────────────────────────────────────────
      
      IF bb.direction == 'bull':
        IF newCandle.close > bb.high:       # 완전히 위에서 종가 → 성공
          bb.retestStatus = 'success'
        ELSE IF newCandle.close < bb.low:   # 완전히 아래에서 종가 → 무효화
          bb.retestStatus = 'failed'
          bb.status = 'invalidated'
      
      IF bb.direction == 'bear':
        IF newCandle.close < bb.low:        # 완전히 아래에서 종가 → 성공
          bb.retestStatus = 'success'
        ELSE IF newCandle.close > bb.high:  # 완전히 위에서 종가 → 무효화
          bb.retestStatus = 'failed'
          bb.status = 'invalidated'
```

---

## 9. 모듈 6 — 유동성 스윕 감지

### 9.1 스윕 정의

스윙 레벨을 **wick으로 돌파 후 빠르게 되돌아오는 패턴**. 종가는 레벨 안쪽에 있어야 한다.

### 9.2 감지 알고리즘

```
detectLiquiditySweeps(candles, swings):
  sweeps = []
  
  FOR each swing IN swings:
    # 스윙 이후 등장한 캔들들을 순회
    FOR each candle AFTER swing.index:
      
      # BSL Sweep: 스윙 고점 위쪽으로 wick 돌출 후 종가는 아래로
      IF swing.type == 'high':
        IF candle.high > swing.price AND candle.close < swing.price:
          # 방향성 후속 무브 확인 (다음 1~3 캔들이 하강)
          followThrough = checkFollowThrough(candles, candle.index, 'bear')
          sweeps.push({
            type: 'bsl',
            target: swing,
            sweepHigh: candle.high,
            closePrice: candle.close,
            time: candle.time,
            confirmed: followThrough
          })
      
      # SSL Sweep: 스윙 저점 아래쪽으로 wick 돌출 후 종가는 위로
      IF swing.type == 'low':
        IF candle.low < swing.price AND candle.close > swing.price:
          followThrough = checkFollowThrough(candles, candle.index, 'bull')
          sweeps.push({
            type: 'ssl',
            target: swing,
            sweepLow: candle.low,
            closePrice: candle.close,
            time: candle.time,
            confirmed: followThrough
          })
      
      BREAK  # 같은 스윙에 대해 첫 번째 스윕만 감지
  
  RETURN sweeps

# 방향성 후속 무브 확인
checkFollowThrough(candles, startIndex, direction, lookForward = 3):
  FOR j = startIndex+1 TO startIndex+lookForward:
    IF direction == 'bull' AND candles[j].close > candles[j].open:
      RETURN true  # 상승 확인
    IF direction == 'bear' AND candles[j].close < candles[j].open:
      RETURN true  # 하강 확인
  RETURN false
```

### 9.3 스윕 강도 등급

| 등급 | 조건 | 설명 |
|------|------|------|
| **Strong** | wick 돌파 + 종가 되돌림 + 후속 무브 3캔들 확인 | 신뢰도 높음 |
| **Medium** | wick 돌파 + 종가 되돌림 (후속 미확인) | 신뢰도 중간 |
| **Weak** | 레벨 터치만 + 되돌림 (wick 없이) | 신호 약함 |

---

## 10. 모듈 7 — Displacement 캔들 필터

### 10.1 정의

주변 캔들 대비 **유의미하게 큰 방향성 캔들**. 절대값이 아닌 **상대적 기준**으로 판별한다.

### 10.2 감지 알고리즘

```
isDisplacement(candle, candles, index, config):
  {
    rollingWindow = config.displacementWindow || 10,  # 이동 평균 기간
    bodyMultiplier = config.bodyMultiplier   || 1.5,  # 최소 1.5x 평균 바디
    maxWickRatio   = config.maxWickRatio     || 0.3,  # 반대 방향 wick ≤ 30%
    closeAtExtremeRatio = config.closeAtExtreme || 0.6  # 종가가 범위의 60% 이상 위치
  }
  
  # Step 1: 롤링 평균 바디 크기 계산
  window = candles[max(0, index-rollingWindow)..index-1]
  avgBodySize = mean(|c.close - c.open| FOR c IN window)
  
  # Step 2: 현재 캔들 바디 크기
  bodySize = |candle.close - candle.open|
  
  # Step 3: 바디 크기 조건 (1.5x ~ 2.5x 평균)
  IF bodySize < avgBodySize * bodyMultiplier: RETURN false
  
  # Step 4: 방향성 확인 (강세 또는 약세)
  isBullish = candle.close > candle.open
  
  # Step 5: 반대 방향 wick 비율 확인
  totalRange = candle.high - candle.low
  IF isBullish:
    oppositeWick = candle.open - candle.low   # 하단 wick
  ELSE:
    oppositeWick = candle.high - candle.close  # 상단 wick
  
  IF totalRange > 0 AND (oppositeWick / totalRange) > maxWickRatio:
    RETURN false  # 반대 방향 wick이 너무 큼 → 확신 없음
  
  # Step 6: 종가가 범위의 극단에 위치
  IF isBullish:
    closePosition = (candle.close - candle.low) / totalRange
  ELSE:
    closePosition = (candle.high - candle.close) / totalRange
  
  IF closePosition < closeAtExtremeRatio: RETURN false
  
  RETURN true
```

### 10.3 파라미터 기본값 요약

| 파라미터 | 기본값 | 근거 |
|---------|--------|------|
| `rollingWindow` | 10 | 최근 10봉 평균 |
| `bodyMultiplier` | 1.5 | knowledge-base §D: 1.5x~2.5x |
| `maxWickRatio` | 0.3 | 반대 wick 최대 30% |
| `closeAtExtremeRatio` | 0.6 | 범위의 상위/하위 60% 이상 |

---

## 11. 모듈 8 — HTF-LTF 정렬 점수

### 11.1 티어 분류

knowledge-base §F의 티어를 그대로 구현한다.

| 티어 | 조건 | 확률 | 진입 여부 |
|------|------|------|---------|
| **Tier 1** | HTF 추세 + LTF가 HTF 방향으로 BOS | 75%+ | ✅ 진입 |
| **Tier 2** | HTF 추세 + LTF가 HTF 레벨에서 지속 | 60-75% | ✅ 진입 |
| **Tier 3** | HTF 추세 + LTF가 HTF 레벨에서 횡보 | 50-60% | ⚠️ 소규모 |
| **Tier 4** | HTF 추세 + LTF가 반대 방향 | 35-50% | ❌ 회피 |
| **Tier 5** | HTF + LTF 모두 횡보 | 40-50% | ❌ 회피 |

### 11.2 정렬 점수 계산 알고리즘

```
calculateAlignmentScore(htfAnalysis, ltfAnalysis):
  score = 0
  tier  = 5
  
  htfTrend = htfAnalysis.trend   # 'bull' | 'bear' | 'ranging'
  ltfTrend = ltfAnalysis.trend   # 'bull' | 'bear' | 'ranging'
  
  # ── 가중치 배분 (knowledge-base §F 기준) ──
  # HTF 바이어스:        50%
  # LTF 구조 정렬:       30%
  # OB/FVG 컨플루언스:   20%
  
  htfScore  = 0
  ltfScore  = 0
  poiScore  = 0
  
  # HTF 점수 (0~50)
  IF htfTrend != 'ranging':
    htfScore = 40  # 명확한 추세
    IF htfAnalysis.hasRecentBOS: htfScore += 10
  ELSE:
    htfScore = 10  # 횡보
  
  # LTF 점수 (0~30)
  IF htfTrend != 'ranging':
    IF ltfTrend == htfTrend:
      ltfScore = 30  # 완전 정렬
    ELSE IF ltfTrend == 'ranging':
      ltfScore = 15  # 횡보 (되돌림 중)
    ELSE:
      ltfScore = 0   # 역방향
  ELSE:
    ltfScore = 15  # HTF 횡보 시 LTF 독립적
  
  # POI 컨플루언스 점수 (0~20)
  confluenceCount = 0
  IF ltfAnalysis.priceInHTF_OB:  confluenceCount++
  IF ltfAnalysis.priceInHTF_FVG: confluenceCount++
  IF ltfAnalysis.priceInHTF_BB:  confluenceCount++
  poiScore = min(20, confluenceCount * 10)
  
  totalScore = htfScore + ltfScore + poiScore  # 0~100
  
  # 티어 판별
  IF htfTrend != 'ranging':
    IF ltfTrend == htfTrend AND ltfAnalysis.hasRecentBOS_in_htfDir:
      tier = 1
    ELSE IF ltfTrend == htfTrend:
      tier = 2
    ELSE IF ltfTrend == 'ranging':
      tier = 3
    ELSE:
      tier = 4
  ELSE:
    tier = 5
  
  RETURN {
    score: totalScore,   # 0~100 연속값
    tier:  tier,         # 1~5 이산값
    htfBias:    htfTrend,
    ltfBias:    ltfTrend,
    isAligned:  tier <= 2,
    canTrade:   tier <= 3
  }
```

### 11.3 진입 결정 규칙

```
IF alignment.tier == 1 OR tier == 2:
  → ENTER with full position size
IF alignment.tier == 3:
  → ENTER with 50% position size, tighter SL
IF alignment.tier == 4 OR tier == 5:
  → SKIP (no entry)
```

---

## 12. 모듈 9 — AMD 사이클 상태 머신

### 12.1 상태 정의

```
States: ACCUMULATION → MANIPULATION → DISTRIBUTION → RESET
```

### 12.2 전환 조건

```
AMD State Machine:

ACCUMULATION:
  - 가격 범위가 좁음 (EQH/EQL 형성)
  - BOS/MSS 없음
  → MANIPULATION 전환 조건: 갑작스러운 방향성 Sweep 발생

MANIPULATION:
  - BSL 또는 SSL Sweep 감지
  - 반대 방향 위장 무브
  → DISTRIBUTION 전환 조건: Displacement + 구조 BOS 확인

DISTRIBUTION:
  - 강한 Displacement 캔들
  - FVG 형성
  - BOS 발생
  → RESET 전환 조건: 목표 POI 도달 또는 새 횡보 구간 형성

RESET:
  - 다음 사이클의 ACCUMULATION으로 재진입
```

### 12.3 구현 스케치

```
detectAMDPhase(candles, swings, sweeps, bosEvents):
  recentSweep    = sweeps.filter(s => s.confirmed).last()
  recentBOS      = bosEvents.last()
  recentSwings   = swings.last(10)
  
  # ACCUMULATION 판단: 스윙 범위가 좁음 + 스윕/BOS 없음
  swingRange = max(recentSwings.prices) - min(recentSwings.prices)
  avgRange   = calculateAvgCandleRange(candles, 20)
  IF swingRange < avgRange * 3 AND !recentSweep AND !recentBOS:
    RETURN 'ACCUMULATION'
  
  # MANIPULATION 판단: 최근 스윕 발생
  IF recentSweep AND recentSweep withinLast(10, candles):
    RETURN 'MANIPULATION'
  
  # DISTRIBUTION 판단: BOS + Displacement 확인
  IF recentBOS AND recentBOS withinLast(5, candles):
    IF anyDisplacementNear(candles, recentBOS.index):
      RETURN 'DISTRIBUTION'
  
  RETURN 'UNKNOWN'
```

---

## 13. 모듈 10 — Killzone 필터

### 13.1 킬존 정의 (UTC 기준)

| 킬존 | UTC 시작 | UTC 종료 | KST |
|------|---------|---------|-----|
| 아시아 오픈 | 00:00 | 02:00 | 09:00~11:00 |
| 런던 오픈 | 07:00 | 09:00 | 16:00~18:00 |
| 뉴욕 오픈 | 12:00 | 14:00 | 21:00~23:00 |
| 뉴욕 PM | 18:00 | 20:00 | 03:00~05:00 |

### 13.2 킬존 필터 함수

```
isInKillzone(timestampUTC):
  hour = getUTCHour(timestampUTC)
  
  KILLZONES = [
    { name: 'asia',    start:  0, end:  2 },
    { name: 'london',  start:  7, end:  9 },
    { name: 'new_york',start: 12, end: 14 },
    { name: 'ny_pm',   start: 18, end: 20 }
  ]
  
  FOR kz IN KILLZONES:
    IF hour >= kz.start AND hour < kz.end:
      RETURN { inKillzone: true, name: kz.name }
  
  RETURN { inKillzone: false, name: null }

# 킬존 가중치: 신호 발생 시 킬존 여부에 따라 confidence 조정
getKillzoneBonus(killzoneResult):
  IF !killzoneResult.inKillzone: RETURN 0
  IF killzoneResult.name IN ['london', 'new_york']: RETURN 15  # 주요 킬존 +15점
  RETURN 5  # 기타 킬존 +5점
```

---

## 14. 모듈 11 — 진입점 스코어카드

> **출처**: knowledge-base §G — Scorecard / Confluence Ranking System

### 14.1 개요

스코어카드는 겉보기에 동일한 ICT 셋업(MSS + FVG) 사이에서 **가짜 함정을 걸러내고 실제 기관 자리를 식별**하기 위한 5항목 컨플루언스 채점 시스템이다. M8(HTF-LTF 정렬 티어)이 구조적 맥락을 평가한다면, 스코어카드는 **현재 진입 캔들이 맞는 자리인지**를 최종 확인하는 필터다.

- **채점 범위**: -1 ~ 6점
- **최소 진입 기준**: 3점 이상 (Tier 1/2 전제)
- **S급 타점**: 5~6점

### 14.2 5대 평가 항목

#### 항목 1 — 구조 (Structure): HTF 추세 방향 일치 (+1)

```
scoreStructure(htfTrend, entryDirection):
  IF htfTrend == 'bull' AND entryDirection == 'LONG':  RETURN 1
  IF htfTrend == 'bear' AND entryDirection == 'SHORT': RETURN 1
  RETURN 0
```

#### 항목 2 — 시간 (Time): 킬존 내 발생 (+1)

```
scoreTime(killzoneResult):
  IF killzoneResult.inKillzone: RETURN 1
  RETURN 0

# 킬존 우선순위 (점수는 동일하지만 메타데이터로 기록)
# 런던/뉴욕 오픈: 최우선 (±주요 킬존)
# 아시아/뉴욕 PM: 차순위
```

#### 항목 3 — 가격 (Price): OTE 구간 여부 (+1 / +0.5 / -1)

**OTE(Optimal Trade Entry)**: 피보나치 0.62 ~ 0.79 되돌림 구간. 기관이 포지션을 쌓는 최적화된 할인(LONG) / 할증(SHORT) 구간.

```
scorePrice(entryPrice, swingHigh, swingLow, entryDirection):
  range = swingHigh - swingLow
  
  IF entryDirection == 'LONG':
    # 되돌림 비율: 1.0 = swingHigh, 0.0 = swingLow
    retracementPct = (swingHigh - entryPrice) / range
    
    IF 0.62 <= retracementPct <= 0.79: RETURN 1      # OTE 구간 (할인대 최적)
    IF 0.50 <= retracementPct < 0.62:  RETURN 0.5   # 얕은 되돌림 (허용)
    IF retracementPct < 0.50:          RETURN -1     # 프리미엄 구간 — 진입 금지
    IF retracementPct > 0.79:          RETURN 0      # 과도한 되돌림 (무난)
  
  IF entryDirection == 'SHORT':
    # 되돌림 비율: 0.0 = swingLow, 1.0 = swingHigh
    retracementPct = (entryPrice - swingLow) / range
    
    IF 0.62 <= retracementPct <= 0.79: RETURN 1
    IF 0.50 <= retracementPct < 0.62:  RETURN 0.5
    IF retracementPct < 0.50:          RETURN -1     # 할인 구간에서 Short — 진입 금지
    IF retracementPct > 0.79:          RETURN 0
  
  RETURN 0

# OTE 피보나치 레벨 (참조값)
OTE_LEVELS = {
  discount_premium_boundary: 0.50,  # 50% 중심선
  ote_entry_start:            0.62,  # OTE 시작
  ote_entry_end:              0.79,  # OTE 끝 (최적)
  deep_retracement:           0.886  # 깊은 되돌림 (구조 무효화 경계)
}
```

> **주의**: OTE 판단을 위한 swingHigh/swingLow는 **LTF 기준 가장 최근의 유의미한 스윙** (M1 detectSwingPoints 출력)을 사용한다.

#### 항목 4 — PD 배열 (PD Array): POI 중첩 강도 (+0 / +1 / +2)

```
scorePDArray(entryZone, activeFVGs, activeOBs, activeBBs):
  # 진입 구간과 겹치는 활성 POI 수집
  overlapping = []
  
  FOR fvg IN activeFVGs:
    IF zonesOverlap(entryZone, fvg): overlapping.push('FVG')
  
  FOR ob IN activeOBs:
    IF zonesOverlap(entryZone, ob): overlapping.push('OB')
  
  FOR bb IN activeBBs WHERE bb.retestStatus == 'pending':
    IF zonesOverlap(entryZone, bb): overlapping.push('BB')
  
  count = overlapping.length
  
  IF count == 0: RETURN 0     # FVG 단일 근거 (기본 POI만)
  IF count == 1: RETURN 1     # OB+FVG 등 2개 중첩
  IF count >= 2: RETURN 2     # 3개 이상 중첩 or BB+FVG (유니콘 셋업)
  
  # 구역 겹침 판별
  zonesOverlap(a, b):
    RETURN a.low <= b.high AND a.high >= b.low

# 중첩 등급 레이블
PD_GRADE = { 0: '단일', 1: '이중', 2: '유니콘(콘크리트)' }
```

#### 항목 5 — 유동성 (Liquidity): 직전 스윕 선행 여부 (+1)

```
scoreLiquidity(sweeps, entryTime, lookbackCandles = 20):
  # 진입 시점 기준 최근 lookbackCandles 내 확인된 스윕 존재 여부
  recentSweeps = sweeps.filter(s =>
    s.confirmed == true AND
    s.time >= entryTime - (lookbackCandles * candleDuration)
  )
  
  IF recentSweeps.length > 0: RETURN 1
  RETURN 0
```

### 14.3 스코어카드 종합 계산

```
calculateEntryScorecard(params):
  {
    htfTrend, entryDirection,
    killzoneResult,
    entryPrice, swingHigh, swingLow,
    entryZone, activeFVGs, activeOBs, activeBBs,
    sweeps, entryTime
  } = params
  
  s1 = scoreStructure(htfTrend, entryDirection)
  s2 = scoreTime(killzoneResult)
  s3 = scorePrice(entryPrice, swingHigh, swingLow, entryDirection)
  s4 = scorePDArray(entryZone, activeFVGs, activeOBs, activeBBs)
  s5 = scoreLiquidity(sweeps, entryTime)
  
  total = s1 + s2 + s3 + s4 + s5  # 범위: -1 ~ 6
  
  RETURN {
    total:      total,
    breakdown:  { structure: s1, time: s2, price: s3, pdArray: s4, liquidity: s5 },
    grade:      getScoreGrade(total),
    oteZone:    classifyOTE(entryPrice, swingHigh, swingLow, entryDirection)
  }

getScoreGrade(score):
  IF score >= 5: RETURN 'S'   # S급 타점 — 적극 진입
  IF score >= 3: RETURN 'A'   # A급 — 진입
  IF score >= 2: RETURN 'B'   # B급 — 소규모 또는 대기
  IF score >= 0: RETURN 'C'   # C급 — Skip
  RETURN 'X'                  # X급 (음수) — 진입 절대 금지

classifyOTE(entryPrice, swingHigh, swingLow, direction):
  retPct = direction == 'LONG'
    ? (swingHigh - entryPrice) / (swingHigh - swingLow)
    : (entryPrice - swingLow)  / (swingHigh - swingLow)
  
  IF retPct >= 0.62 AND retPct <= 0.79: RETURN 'OTE'
  IF retPct >= 0.50 AND retPct <  0.62: RETURN 'SHALLOW'
  IF retPct >  0.79:                    RETURN 'DEEP'
  RETURN 'PREMIUM'  # 잘못된 구간
```

### 14.4 스코어카드 × HTF-LTF 티어 통합 결정 매트릭스

스코어카드 등급(행) × HTF-LTF 정렬 티어(열)의 교점이 최종 진입 등급이 된다.

| 스코어카드 | Tier 1 (75%+) | Tier 2 (60~75%) | Tier 3 (50~60%) | Tier 4/5 |
|-----------|--------------|----------------|----------------|---------|
| **S (5~6점)** | 🟢 Full — 적극 진입 | 🟢 Full | 🟡 50% | ❌ Skip |
| **A (3~4점)** | 🟢 Full | 🟡 Full / 주의 | 🟡 50% | ❌ Skip |
| **B (2점)**   | 🟡 50% | 🟡 50% | ❌ Skip | ❌ Skip |
| **C (0~1점)** | ❌ Skip | ❌ Skip | ❌ Skip | ❌ Skip |
| **X (음수)**  | 🚫 금지 | 🚫 금지 | 🚫 금지 | 🚫 금지 |

```
finalEntryDecision(tier, scorecardGrade):
  IF scorecardGrade == 'X': RETURN { action: 'BLOCK', sizeMultiplier: 0 }
  IF scorecardGrade == 'C': RETURN { action: 'SKIP',  sizeMultiplier: 0 }
  IF tier >= 4:             RETURN { action: 'SKIP',  sizeMultiplier: 0 }
  
  IF   scorecardGrade == 'S' AND tier <= 2: RETURN { action: 'ENTER', sizeMultiplier: 1.0 }
  ELIF scorecardGrade == 'A' AND tier <= 2: RETURN { action: 'ENTER', sizeMultiplier: 1.0 }
  ELIF scorecardGrade == 'S' AND tier == 3: RETURN { action: 'ENTER', sizeMultiplier: 0.5 }
  ELIF scorecardGrade == 'A' AND tier == 3: RETURN { action: 'ENTER', sizeMultiplier: 0.5 }
  ELIF scorecardGrade == 'B' AND tier <= 2: RETURN { action: 'ENTER', sizeMultiplier: 0.5 }
  ELSE:                                     RETURN { action: 'SKIP',  sizeMultiplier: 0 }
```

### 14.5 스코어카드 실전 예시 비교

| 구분 | S1 구조 | S2 시간 | S3 가격 | S4 배열 | S5 유동성 | 합계 | 등급 | 결과 |
|------|---------|---------|---------|---------|---------|------|------|------|
| **함정 패턴 (A자리)** | +1 | 0 (아시아 세션) | -1 (프리미엄 FVG) | 0 (단일) | 0 (스윕 없음) | **0** | C | ❌ Skip |
| **S급 타점 (B자리)** | +1 | +1 (뉴욕 킬존) | +1 (OTE 도달) | +2 (OB+FVG) | +1 (스윕 직후) | **6** | S | ✅ Full |

---

## 15. 신호 출력 스키마

```js
/**
 * @typedef {Object} ICTSignal
 * @property {string}  pair           - 페어 심볼
 * @property {number}  timestamp      - 신호 생성 시각 (Unix, UTC)
 * @property {string}  analysisDate   - 분석 날짜 (YYYY-MM-DD)
 *
 * @property {'LONG'|'SHORT'|'NEUTRAL'} direction - 바이어스
 * @property {1|2|3|4|5} tier         - HTF-LTF 정렬 티어
 * @property {number}  alignmentScore - 0~100 정렬 점수
 * @property {'HIGH'|'MEDIUM'|'LOW'} confidence - 전체 확신도
 *
 * @property {Object}  scorecard                  - 진입점 스코어카드 (§14)
 * @property {number}  scorecard.total            - 합계 점수 (-1~6)
 * @property {'S'|'A'|'B'|'C'|'X'} scorecard.grade - 등급
 * @property {Object}  scorecard.breakdown        - 항목별 점수
 * @property {number}  scorecard.breakdown.structure  - S1 구조 (0|1)
 * @property {number}  scorecard.breakdown.time       - S2 시간 (0|1)
 * @property {number}  scorecard.breakdown.price      - S3 가격 (-1|0|0.5|1)
 * @property {number}  scorecard.breakdown.pdArray    - S4 PD배열 (0|1|2)
 * @property {number}  scorecard.breakdown.liquidity  - S5 유동성 (0|1)
 * @property {'OTE'|'SHALLOW'|'DEEP'|'PREMIUM'} scorecard.oteZone - OTE 구간 분류
 * @property {'ENTER'|'SKIP'|'BLOCK'} scorecard.action - 최종 진입 결정
 * @property {number}  scorecard.sizeMultiplier   - 포지션 사이즈 배수 (0|0.5|1.0)
 *
 * @property {Object}  entry
 * @property {number}  entry.price    - 진입 목표가
 * @property {string}  entry.basis    - 진입 근거 ('FVG_RETEST' | 'OB_RETEST' | 'BB_RETEST' | 'SWEEP_CONFIRM')
 * @property {boolean} entry.killzone - 킬존 내 발생 여부
 *
 * @property {number}  sl             - 손절가
 * @property {string}  slBasis        - SL 근거 ('BELOW_SWING_LOW' | 'BELOW_OB' | 'ABOVE_SWING_HIGH' | 'ABOVE_OB')
 *
 * @property {number[]} tp            - [TP1, TP2, TP3] 익절 목표가
 * @property {string[]} tpBasis       - TP별 근거 배열
 * @property {number}  rr             - R:R 비율 (TP1 기준)
 *
 * @property {Object}  structure
 * @property {string}  structure.htfTrend    - HTF 추세
 * @property {string}  structure.ltfTrend    - LTF 추세
 * @property {string}  structure.amdPhase    - AMD 사이클 단계
 * @property {string[]} structure.confluence - 수렴 레벨 목록
 *
 * @property {Object}  levels
 * @property {FVG[]}   levels.fvgs     - 활성 FVG 목록
 * @property {OrderBlock[]} levels.obs - 활성 OB 목록
 * @property {BreakerBlock[]} levels.bbs - 추적 중인 BB 목록
 * @property {SweepEvent[]} levels.sweeps - 최근 스윕 이벤트
 *
 * @property {Object}  invalidation
 * @property {number}  invalidation.price  - 무효화 가격
 * @property {string}  invalidation.reason - 무효화 사유
 *
 * @property {boolean} tradeBlocked    - 뉴스 이벤트 등으로 진입 금지
 * @property {string}  tradeBlockReason
 */
```

### 15.1 confidence 산출 기준

```
calculateConfidence(alignmentScore, killzoneBonus, sweepConfirmed, amdPhase):
  total = alignmentScore + killzoneBonus
  
  # AMD 보너스
  IF amdPhase == 'MANIPULATION': total += 10  # 스윕 직후
  IF amdPhase == 'DISTRIBUTION': total += 5
  
  # 스윕 확인 여부
  IF sweepConfirmed: total += 10
  
  IF total >= 80: RETURN 'HIGH'
  IF total >= 60: RETURN 'MEDIUM'
  RETURN 'LOW'
```

---

## 16. 무효화 조건

신호 발생 후 다음 조건 중 하나가 충족되면 신호를 무효화한다.

### 16.1 구조적 무효화

```
LONG 신호 무효화:
  □ 진입 OB / FVG의 하단을 종가로 이탈
  □ 진입 Breaker Block를 종가로 완전 이탈 (§8.4)
  □ HTF 스윙 저점을 종가로 이탈
  □ HTF 추세가 'bear'로 전환 (MSS 발생)

SHORT 신호 무효화:
  □ 진입 OB / FVG의 상단을 종가로 이탈
  □ 진입 Breaker Block를 종가로 완전 이탈
  □ HTF 스윙 고점을 종가로 이탈
  □ HTF 추세가 'bull'로 전환 (MSS 발생)
```

### 16.2 오더플로우 무효화 (선택)

외부 데이터(coinalyze_data.json)가 있을 경우:

```
□ CVD 방향이 신호와 반대로 전환 + 지속 3시간 이상
□ OI가 급감 (대량 청산) + 가격 역전
```

### 16.3 시간 기반 무효화

```
□ 신호 발생 후 킬존 2회 경과 (≈ 16시간) 동안 진입점 미터치 → 신호 만료
□ 주요 뉴스 이벤트 ±2시간 → 진입 금지 (tradeBlocked = true)
```

---

## 17. 통합 파이프라인 흐름

```
analyzeICT(params):
  
  ── 전처리 ──────────────────────────────────────────────
  1. validateInput(params)
  2. htfCandles = normalize(params.htfCandles)
  3. ltfCandles = normalize(params.ltfCandles)
  
  ── HTF 분석 ─────────────────────────────────────────────
  4.  htfSwings   = detectSwingPoints(htfCandles, left=5, right=5)
  5.  htfStructure = detectBOS(htfCandles, htfSwings)
                   + detectMSS(htfCandles, htfSwings)
  6.  htfFVGs     = detectFVG(htfCandles)
  7.  htfOBs      = detectOrderBlocks(htfCandles)
  8.  htfBBs      = detectBreakerBlocks(htfCandles, htfSwings, htfStructure)
  9.  htfSweeps   = detectLiquiditySweeps(htfCandles, htfSwings)
  10. htfTrend    = getCurrentTrend(htfSwings)
  11. htfAMD      = detectAMDPhase(htfCandles, htfSwings, htfSweeps, htfStructure)
  
  ── LTF 분석 ─────────────────────────────────────────────
  12. ltfSwings   = detectSwingPoints(ltfCandles, left=3, right=3)
  13. ltfStructure = detectBOS(ltfCandles, ltfSwings)
  14. ltfFVGs     = detectFVG(ltfCandles)
  15. ltfOBs      = detectOrderBlocks(ltfCandles)
  16. ltfSweeps   = detectLiquiditySweeps(ltfCandles, ltfSwings)
  17. ltfTrend    = getCurrentTrend(ltfSwings)
  
  ── 교차 분석 ────────────────────────────────────────────
  18. alignment   = calculateAlignmentScore(htfAnalysis, ltfAnalysis)
  
  IF alignment.tier >= 4: RETURN { direction: 'NEUTRAL', tier: alignment.tier, ... }
  
  ── 진입 POI 선택 ─────────────────────────────────────────
  19. entryZone = selectBestPOI({
        fvgs:    [...htfFVGs.active, ...ltfFVGs.active],
        obs:     [...htfOBs.active,  ...ltfOBs.active],
        bbs:     htfBBs.filter(bb => bb.retestStatus == 'pending'),
        sweeps:  htfSweeps.filter(s => s.confirmed),
        direction: alignment.htfBias
      })
  
  ── 킬존 필터 ────────────────────────────────────────────
  20. kz = isInKillzone(currentTime)
  
  ── 진입점 스코어카드 (§14) ──────────────────────────────
  21. scorecard = calculateEntryScorecard({
        htfTrend:      alignment.htfBias,
        entryDirection: alignment.htfBias == 'bull' ? 'LONG' : 'SHORT',
        killzoneResult: kz,
        entryPrice:    entryZone.price,
        swingHigh:     htfSwings.filter(s => s.type=='high').last().price,
        swingLow:      htfSwings.filter(s => s.type=='low').last().price,
        entryZone,
        activeFVGs:    [...htfFVGs, ...ltfFVGs].filter(f => f.status=='active'),
        activeOBs:     [...htfOBs,  ...ltfOBs].filter(o => o.status=='active'),
        activeBBs:     htfBBs.filter(b => b.retestStatus=='pending'),
        sweeps:        [...htfSweeps, ...ltfSweeps],
        entryTime:     currentTime
      })
  
  22. decision = finalEntryDecision(alignment.tier, scorecard.grade)
  IF decision.action != 'ENTER':
    RETURN { direction: 'NEUTRAL', scorecard, reason: decision.action }
  
  ── SL / TP 계산 ─────────────────────────────────────────
  23. sl   = calculateSL(entryZone, htfSwings, alignment.htfBias)
  24. tps  = calculateTP(entryZone, htfFVGs, htfOBs, htfSwings, alignment.htfBias)
  25. rr   = (tps[0] - entryZone.price) / (entryZone.price - sl)  # LONG 기준
  
  ── 신뢰도 산출 ──────────────────────────────────────────
  26. confidence = calculateConfidence(
        alignment.score,
        getKillzoneBonus(kz),
        htfSweeps.last()?.confirmed,
        htfAMD
      )
  
  ── 출력 ─────────────────────────────────────────────────
  27. RETURN buildSignal({
        alignment, entryZone, sl, tps, rr, confidence,
        scorecard,
        sizeMultiplier: decision.sizeMultiplier,
        ...
      })
```

---

## 18. 설정 상수

`scripts/config/ict-engine.json`에 관리하며, 호출 시 `params.config`로 오버라이드 가능하다.

```json
{
  "swingPoint": {
    "htf": { "leftBars": 5, "rightBars": 5 },
    "ltf": { "leftBars": 3, "rightBars": 3 }
  },
  "fvg": {
    "minGapPct": 0.001
  },
  "displacement": {
    "rollingWindow": 10,
    "bodyMultiplier": 1.5,
    "maxWickRatio": 0.3,
    "closeAtExtremeRatio": 0.6
  },
  "breakerBlock": {
    "retestMinCandles": 5,
    "retestMaxCandles": 20,
    "immediateReverseCandles": 3
  },
  "sweep": {
    "followThroughLookforward": 3
  },
  "equalLevel": {
    "tolerancePct": 0.001
  },
  "scorecard": {
    "ote": {
      "start": 0.62,
      "end": 0.79,
      "shallowStart": 0.50
    },
    "liquidity": {
      "lookbackCandles": 20
    },
    "minGrade": "A",
    "_gradeOptions": ["S", "A", "B", "C", "X"],
    "gradeThresholds": {
      "S": 5,
      "A": 3,
      "B": 2,
      "C": 0
    }
  },
  "signal": {
    "minRR": 2.0,
    "minAlignmentScore": 60,
    "maxTier": 3
  },
  "killzone": {
    "utc": [
      { "name": "asia",     "start": 0,  "end": 2  },
      { "name": "london",   "start": 7,  "end": 9  },
      { "name": "new_york", "start": 12, "end": 14 },
      { "name": "ny_pm",    "start": 18, "end": 20 }
    ]
  },
  "amd": {
    "accumulationRangeMultiplier": 3,
    "manipulationLookback": 10
  }
}
```

---

## 부록 A — 모듈 의존성 다이어그램

```
detectSwingPoints()
  └─ detectBOS()
  └─ detectMSS()
  └─ detectCHoCH()
  └─ getCurrentTrend()
  └─ detectLiquiditySweeps()
      └─ checkFollowThrough()
  └─ detectBreakerBlocks()
      └─ trackBreakerBlockRetest()

isDisplacement()
  └─ detectOrderBlocks()
  └─ detectBreakerBlocks()

detectFVG()
  └─ updateFVGStatus()

calculateAlignmentScore()  ← htfAnalysis + ltfAnalysis
detectAMDPhase()
isInKillzone()
calculateConfidence()

calculateEntryScorecard()  ← entryZone + FVGs + OBs + BBs + sweeps + kz + swings
  └─ scoreStructure()      ← htfTrend + entryDirection
  └─ scoreTime()           ← killzoneResult
  └─ scorePrice()          ← entryPrice + swingHigh + swingLow (OTE 피보나치)
  └─ scorePDArray()        ← activeFVGs + activeOBs + activeBBs
  └─ scoreLiquidity()      ← sweeps (lookback 20캔들)
  └─ finalEntryDecision()  ← tier + scorecardGrade → action + sizeMultiplier

selectBestPOI()
calculateSL()
calculateTP()
buildSignal()  ← + scorecard + sizeMultiplier
```

## 부록 B — 금지 동작 (NOT DO)

| # | 금지 항목 | 근거 |
|---|---------|------|
| 1 | wick 기준 BOS 인정 | 종가 기준만 유효 |
| 2 | CHoCH 단독으로 진입 | 선행 경고 신호일 뿐 |
| 3 | Tier 4/5에서 진입 | knowledge-base §F 결정 트리 |
| 4 | R:R 2:1 미만 신호 출력 | knowledge-base §7.3 |
| 5 | 뉴스 이벤트 ±2시간 진입 | knowledge-base §8.2 |
| 6 | OB 완전 관통 후 재사용 | 무효화된 OB는 status='invalidated' |
| 7 | 추정값으로 레벨 생성 | 차트 미확인 레벨 금지 |
| 8 | Breaker Block 즉시 반전 시 생성 | 3캔들 방향 지속 미확인 시 불인정 |
| 9 | 스코어카드 C/X 등급에서 진입 | S3 음수(-1) 포함 시 즉시 BLOCK |
| 10 | OTE 미달(프리미엄 구간) LONG 진입 | S3 = -1 → scorecard.action = 'BLOCK' |
| 11 | 스윕 없이 PD 배열 단일 근거만으로 진입 | S4=0, S5=0 → 최대 2점 → C급 |

---

**끝**
