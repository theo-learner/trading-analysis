# ICT (Inner Circle Trader) 거래 기초 지식 총정리

**생성 일자**: 2026-05-14  
**출처**: Google NotebookLM (General Research Notebook)  
**형식**: 10개 핵심 주제별 Q&A + 각 항목 출처 명시

---

## 목차

1. [개요 및 핵심 개념](#1-개요-및-핵심-개념)
2. [시장 구조와 유동성 개념](#2-시장-구조와-유동성-개념)
3. [Entry Chain 및 진입 전략](#3-entry-chain-및-진입-전략)
4. [Higher Timeframe (HTF) - Lower Timeframe (LTF) 동기화](#4-higher-timeframe-htf---lower-timeframe-ltf-동기화)
5. [유동성 사냥 (Liquidity Hunting) 메커니즘](#5-유동성-사냥-liquidity-hunting-메커니즘)
6. [Killzone 및 AMD 사이클](#6-killzone-및-amd-사이클)
7. [Stop Loss 및 Take Profit 배치](#7-stop-loss-및-take-profit-배치)
8. [ICT 거래 규칙 및 금지 사항](#8-ict-거래-규칙-및-금지-사항)
9. [Fair Value Gap (FVG) 및 Order Block 활용](#9-fair-value-gap-fvg-및-order-block-활용)
10. [실전 거래 계획 수립 및 리스크 관리](#10-실전-거래-계획-수립-및-리스크-관리)

**알고리즘 설계 수치 기준 (추가 쿼리)**

- [A. MSS와 CHoCH의 정의와 판별 기준](#a-market-structure-shift-mss와-change-of-character-choch의-정의와-판별-기준)
- [B. FVG와 Order Block의 기하학적 정의와 형성 조건](#b-fair-value-gap-fvg과-order-block-ob의-기하학적-정의와-형성-조건)
- [C. 유동성 레벨의 분류, 배치 원리, 스윕 메커니즘](#c-유동성-레벨liquidity-level의-분류-배치-원리-그리고-sweep-메커니즘)
- [D. Displacement 캔들의 정의와 질적 기준](#d-displacement-캔들의-정의와-질적-기준)
- [E. Breaker Block의 정의와 형성 조건, 재테스트 규칙](#e-breaker-block의-정의와-형성-조건-그리고-재테스트-규칙)
- [F. 4H와 1H 사이의 정렬 임계값과 우선순위](#f-4시간봉htf과-1시간봉ltf-사이의-정렬alignment-임계값과-우선순위)
- [G. 스코어카드 — 컨플루언스 랭킹 시스템](#g-스코어카드scorecard--컨플루언스-랭킹-시스템)

---

## 1. 개요 및 핵심 개념

ICT(Inner Circle Trader) 기법은 시장 구조, 유동성, 기관 자금의 흐름을 중심으로 분석하는 거래 방식입니다. 전통적인 기술적 분석과 달리, 가격 행동(Price Action)에서 시장 참여자들의 의도를 읽어내고, 기관이 유동성을 어디에 배치했는지를 파악하는 데 초점을 맞춥니다.[1] [2]

**ICT의 핵심 3대 기둥:**

- **Market Structure** (시장 구조): Break of Structure (BOS), Change of Character (CHoCH), Market Structure Shift (MSS)를 통해 시장의 방향성을 확인
- **Liquidity** (유동성): Buy-Side Liquidity (BSL), Sell-Side Liquidity (SSL), Fair Value Gap (FVG), Order Block 등 기관이 설정한 함정 포인트 인식
- **Point of Interest (POI)**: 가격이 반응하는 핵심 레벨 (이전 High/Low, 유동성 레벨, 기관 거래소 진입점)

ICT 거래자는 가격이 아닌 **시장의 '의도(Intent)'**를 읽습니다. 가격이 어디로 향할지가 아니라, 기관이 유동성을 어디에 설정했는지, 소매 거래자들을 어디에 함정에 빠지게 할지를 분석합니다.[3] [4]

---

## 2. 시장 구조와 유동성 개념

### 2.1 Break of Structure (BOS)

BOS는 이전 High/Low를 돌파하는 것을 의미합니다.[5] 예를 들어:

- **상승 추세 중 BOS**: 이전 Low를 깨고 더 낮은 Low를 형성 → 약세 신호 (상승 구조 붕괴)
- **하강 추세 중 BOS**: 이전 High를 돌파하고 더 높은 High 형성 → 강세 신호 (하강 구조 붕괴)

BOS는 단순히 레벨을 뚫고 가는 것이 아니라, 이전 구조의 '의도'가 반전되었음을 의미합니다.[6]

### 2.2 Buy-Side Liquidity (BSL) vs Sell-Side Liquidity (SSL)

**Buy-Side Liquidity (BSL)**:
- 이전 Low 위쪽에 몰려 있는 Stop Loss들
- 기관이 상승 파동을 시작하기 전, 소매 거래자들의 Short SL을 제거(Sweep)하여 유동성을 흡수하는 지점
- 상승장 초반 깊은 하강(Sweep) 후 강한 상승이 이어지는 패턴[7] [8]

**Sell-Side Liquidity (SSL)**:
- 이전 High 아래쪽에 몰려 있는 Stop Loss들
- 기관이 하강 파동을 시작하기 전, 소매 거래자들의 Long SL을 제거하는 지점
- 하강장 초반 깊은 상승(Sweep) 후 강한 하강이 이어지는 패턴[9]

**Equal Highs (EQH) / Equal Lows (EQL)**:
- 거의 같은 가격에서 두 번 반응하는 구조
- 기관이 유동성을 여러 번 수집하려는 신호[10]
- 두 번째 만남에서 더 강한 무브가 나올 가능성 높음

### 2.3 Fair Value Gap (FVG)

FVG는 세 개의 연속 캔들에서 1번 캔들의 상단과 3번 캔들의 하단 사이에 공백이 생기는 현상입니다.[11] 예:
- 상승 FVG: 캔들 1 (상승), 캔들 2 (하강), 캔들 3 (상승) → 캔들 1의 상단과 캔들 3의 하단 사이 미충전 구간
- FVG는 시장이 기관의 유동성 제거 구간으로, 추후 가격이 이 구간으로 돌아와 채울 가능성이 높음[12]

---

## 3. Entry Chain 및 진입 전략

### 3.1 Entry Chain의 세 단계

ICT 진입 체인은 **Sweep → Displacement → Retest** 세 단계로 구성됩니다.[13]

**1단계: Sweep (유동성 수집)**
- 기관이 소매 거래자들의 SL을 제거하는 단계
- 예: 상승장에서 이전 Low를 깨고 추가 하강하여 Short SL을 쓸어내기
- Sweep 깊이: 보통 이전 구조의 50~100% 정도[14]

**2단계: Displacement (확실한 이동)**
- Sweep 후 기관이 본격적으로 방향을 결정하고 큰 무브를 시작하는 단계
- 이전 High/Low를 명확히 돌파하는 구간
- 강한 캔들들이 연속으로 나타남[15]

**3단계: Retest (재테스트)**
- 큰 무브 이후 이전의 중요한 레벨(예: Displacement 시작점, FVG, Order Block)로 돌아오는 단계
- 기관이 유동성 추가 수집 및 추세 확인 단계
- 여기서 최적 진입점이 형성됨[16]

### 3.2 진입 신호

최적의 진입점은:
1. **Retest 단계에서** 이전 구조의 경계 근처에서
2. **Order Block이나 FVG 있는 지점에서**
3. **4H, 1H 등 낮은 타임프레임이 상위 타임프레임과 동기화**되었을 때[17]

---

## 4. Higher Timeframe (HTF) - Lower Timeframe (LTF) 동기화

### 4.1 멀티타임프레임 분석의 중요성

ICT 기법에서는 반드시 여러 타임프레임을 함께 분석해야 합니다.[18] 예:

- **1D (Daily)**: 주간 구조, 거시 추세 확인
- **4H (4시간)**: 기관 기관이 주로 거래하는 타임프레임
- **1H (1시간)**: 정확한 진입점 판단

### 4.2 동기화 규칙

상승을 예로 들면:
1. **1D가 상승 구조** (1D High 갱신, 1D BSL 형성)
2. **4H도 상승 구조** (4H에서 최근 Low 경계 근처)
3. **1H에서 Retest** (1H Order Block 또는 FVG 형성)
4. → **최적 진입점**: 1H Retest + 4H/1D 구조 동시 확인[19]

반대로, 상위 타임프레임과 하위 타임프레임이 서로 다른 구조를 보이면:
- **상충(Conflict)**: 진입 회피, 더 높은 타임프레임 정렬 대기[20]

### 4.3 Fractal Structure

시장 구조는 프랙탈입니다. 1D의 Sweep-Displacement-Retest 패턴이 4H, 1H에서도 반복됩니다. 각 타임프레임의 Entry Chain을 확인하면 정확한 진입점을 찾을 수 있습니다.[21]

---

## 5. 유동성 사냥 (Liquidity Hunting) 메커니즘

### 5.1 기관의 유동성 수집 전략

기관(Institutional traders)은 충분한 유동성을 확보하기 위해 체계적으로 소매 거래자들의 Stop Loss를 제거합니다.[22]

**상승 후 유동성 수집 (상승장에서의 Sweep):**
1. 상위 타임프레임에서 상승 구조 형성
2. 가격이 이전 Low 근처로 Retest (소매: 여기서 Short 진입)
3. 갑자기 이전 Low를 깨고 추가 하강 (Short SL 쓸어내기)
4. 본격 상승 시작[23]

**하강 후 유동성 수집 (하강장에서의 Sweep):**
1. 하위 타임프레임에서 하강 구조 형성
2. 가격이 이전 High 근처로 Retest (소매: 여기서 Long 진입)
3. 갑자기 이전 High를 돌파하고 추가 상승 (Long SL 쓸어내기)
4. 본격 하강 시작[24]

### 5.2 Equal Highs/Lows (EQH/EQL) 의미

같은 레벨에서 여러 번 가격이 반응한다 = 기관이 여러 번 유동성을 수집하려는 신호[25]

---

## 6. Killzone 및 AMD 사이클

### 6.1 Killzone의 정의

**Killzone**은 기관이 특정 시간대에 주로 거래(청산, 신규 진입)를 하는 시간 구간입니다.[26]

**표준 Killzone:**
- **런던 오픈** (08:00 GMT / KST 16:00)
- **뉴욕 오픈** (13:00 GMT / KST 21:00)
- **아시아 오픈** (00:00-02:00 GMT / KST 08:00-10:00)

### 6.2 AMD 사이클

**A (Accumulation)**: 기관이 포지션을 쌓는 단계
- 가격 범위 좁음 (Consolidation)
- 거래량 높음 (뒤에서 기관이 활동 중)
- 레벨 테스트 반복 (EQH/EQL 형성)[27]

**M (Manipulation)**: 기관이 소매를 함정에 빠뜨리는 단계
- Sweep 발생 (BSL/SSL 유동성 수집)
- 기관이 반대 방향으로 위장 무브 시작
- 소매 거래자들이 SL에 치임[28]

**D (Distribution)**: 기관이 포지션을 팔아치우는 단계
- 큰 무브 시작 (Displacement)
- 거래량 증가
- 가격이 다음 POI로 빠르게 이동[29]

이 사이클은 모든 타임프레임에서 반복됩니다.

---

## 7. Stop Loss 및 Take Profit 배치

### 7.1 Stop Loss (SL) 배치 원칙

**SL은 시장 구조 너머에 배치합니다:**
- **상승 포지션 진입 시**: 최근 (또는 관련) Low 아래로 SL 설정 → 이 Low가 Sweep 깊이로 기능할 수 있으므로 충분히 아래에 배치[30]
- **하강 포지션 진입 시**: 최근 (또는 관련) High 위로 SL 설정

**SL 배치 시 고려:**
1. 시장이 Sweep할 가능성 있는 깊이까지 버틸 여유
2. 너무 넓으면 수익률 악화
3. 너무 좁으면 가짜 Sweep(흔들림)에 손실[31]

### 7.2 Take Profit (TP) 배치 원칙

**TP는 다음 높은 타임프레임의 POI에 배치합니다:**
- 상위 타임프레임의 이전 High/Low (저항/지지)
- Order Block
- FVG
- Equal Highs/Lows[32]

**분할 TP 전략:**
- TP1: 첫 번째 저항 (위험을 0으로 만드는 지점)
- TP2: 두 번째 저항
- TP3: 세 번째 저항[33]

### 7.3 Risk-Reward Ratio (R:R)

최소한 1:2 이상의 R:R을 목표로 합니다.[34]
- 예: SL까지의 거리 = 100달러 → TP까지 최소 200달러 이상 떨어져야 함

---

## 8. ICT 거래 규칙 및 금지 사항

### 8.1 거래 규칙 (MUST DO)

1. **상위 타임프레임 구조 먼저 확인**[35]
   - 1D/4H 구조가 명확하지 않으면 거래 금지

2. **Entry Chain 단계별 진입**[36]
   - Sweep 확인 → Displacement 대기 → Retest에서 진입

3. **확률 높은 시간대 거래**[37]
   - Killzone 근처에서 거래 → 확률 상승
   - 거시 경제 이벤트 2시간 전/후 회피

4. **구조 동기화 필수**[38]
   - HTF와 LTF가 같은 방향을 가리킬 때만 진입

5. **유동성 레벨 확인**[39]
   - Order Block, FVG, BSL/SSL 확인 후 진입

### 8.2 금지 사항 (MUST NOT DO)

1. **거시 구조 확인 없이 거래 금지**[40]
   - 상위 타임프레임이 약세인데 하위 타임프레임 강세에 진입 금지

2. **Sweep 없이 진입 금지**[41]
   - 기관이 유동성을 제거하지 않았으면 추세가 나올 가능성 낮음

3. **뉴스 이벤트 중 거래 금지**[42]
   - 기관이 포지션 재구성 중 → 구조가 깨짐

4. **SL 없이 거래 금지**[43]
   - Risk 제어 불가 → 계정 파산 위험

5. **확인되지 않은 레벨에 진입 금지**[44]
   - 추측 레벨 사용 금지 → 실제 유동성 지점에서만 진입

---

## 9. Fair Value Gap (FVG) 및 Order Block 활용

### 9.1 FVG의 실전 활용

**FVG 판별:**
세 개의 연속 캔들 중:
- 1번 캔들과 3번 캔들 사이에 공백이 생김
- 2번 캔들이 중간에서 반전[45]

**FVG의 역할:**
1. **미충전 구간**: 시장이 이 구간으로 돌아올 가능성 높음[46]
2. **진입점 표시**: FVG 경계에서 Retest 진입 → 위험도 낮음
3. **수익 목표**: FVG 반대편이 다음 거래의 TP가 될 수 있음[47]

**FVG 종류:**
- **Bullish FVG**: 상승 FVG → 향후 지지 역할
- **Bearish FVG**: 하강 FVG → 향후 저항 역할[48]

### 9.2 Order Block (OB) 활용

**Order Block의 정의:**
기관의 거래 출입이 일어나는 가격 구간. 보통 큰 무브 직전의 마지막 상승/하강 캔들(들) 영역입니다.[49]

**Order Block의 특징:**
1. **기관 진입점**: 기관이 대량 매수/매도하는 구간
2. **재테스트 반응**: 이후 가격이 다시 OB로 돌아오면 강한 반응 (바운스 또는 추가 하강)[50]
3. **시장 구조 변곡점**: OB 주변에서 구조가 변하는 경우 많음[51]

**OB 활용 사례:**
- 상승 무브 중 마지막 상승 캔들 → Order Block
- 이후 가격이 하강하여 이 OB로 Retest
- OB에서 바운스 → 상승 재개[52]

---

## 10. 실전 거래 계획 수립 및 리스크 관리

### 10.1 거래 계획 수립 단계

**1단계: 상위 타임프레임 분석 (1D)**[53]
- 1D 추세 방향 (상승/하강/중립)
- 1D 주요 POI (High/Low, 유동성 레벨)
- 1D 구조 상태 (Accumulation/Manipulation/Distribution)

**2단계: 중간 타임프레임 분석 (4H)**[54]
- 4H Entry Chain 진행 상황
- 4H BOS, Sweep 발생 여부
- 4H 유동성 레벨 확인

**3단계: 하위 타임프레임 분석 (1H)**[55]
- 1H Retest 형성 여부
- 1H Order Block/FVG 확인
- 진입점 정확성 판단

**4단계: 거래 시나리오 수립**[56]
- 추세 지속 시나리오: 다음 POI까지 추세 지속
- 반전 시나리오: 주요 레벨에서 반전
- 중립 시나리오: 범위 내 거래

### 10.2 리스크 관리 원칙

**계정 보호:**[57]
1. **일일 손실 한도 설정** → 일일 손실이 특정 % 도달하면 거래 중단
2. **포지션 사이즈 조절** → 거래 자본의 1~2%만 위험에 노출
3. **누적 위험 관리** → 여러 포지션의 총 위험이 자본의 5% 이상 넘지 않기[58]

**각 거래별 위험 관리:**[59]
- SL 설정 필수 (구조 너머)
- R:R 최소 1:2 확보
- 거시 이벤트 시간대 회피
- Killzone 활용하여 실행 우위 확보[60]

### 10.3 심리 관리

**거래자 심리:**[61]
- Sweep에 당하지 않기: 기관이 의도적으로 유동성 수집 → 흔들림으로 판단하지 말 것
- 확신도 낮은 거래 스킵: 구조가 명확하지 않으면 기다릴 것
- 손실 회복 욕구 통제: 손실 후 과도한 거래 금지[62]

---

## 참고 문헌 (Footnote Sources)

[1] NotebookLM Query 1 - ICT 개요 및 핵심 개념  
[2] NotebookLM Query 1 - 기관 자금 흐름 분석  
[3] NotebookLM Query 1 - 시장 의도 읽기  
[4] NotebookLM Query 1 - 소매 vs 기관 관점  
[5] NotebookLM Query 2 - Break of Structure 정의  
[6] NotebookLM Query 2 - BOS 의미 해석  
[7] NotebookLM Query 2 - Buy-Side Liquidity 개념  
[8] NotebookLM Query 2 - Sweep 메커니즘  
[9] NotebookLM Query 2 - Sell-Side Liquidity 개념  
[10] NotebookLM Query 2 - Equal Highs/Lows 의미  
[11] NotebookLM Query 2 - Fair Value Gap 정의  
[12] NotebookLM Query 2 - FVG 충전 패턴  
[13] NotebookLM Query 3 - Entry Chain 세 단계  
[14] NotebookLM Query 3 - Sweep 깊이  
[15] NotebookLM Query 3 - Displacement 특징  
[16] NotebookLM Query 3 - Retest 단계  
[17] NotebookLM Query 3 - 최적 진입 조건  
[18] NotebookLM Query 4 - 멀티타임프레임 중요성  
[19] NotebookLM Query 4 - HTF-LTF 동기화 규칙  
[20] NotebookLM Query 4 - 상충 회피  
[21] NotebookLM Query 4 - Fractal 구조  
[22] NotebookLM Query 5 - 기관 유동성 전략  
[23] NotebookLM Query 5 - 상승 유동성 수집  
[24] NotebookLM Query 5 - 하강 유동성 수집  
[25] NotebookLM Query 5 - EQH/EQL 신호  
[26] NotebookLM Query 6 - Killzone 정의  
[27] NotebookLM Query 6 - Accumulation 단계  
[28] NotebookLM Query 6 - Manipulation 단계  
[29] NotebookLM Query 6 - Distribution 단계  
[30] NotebookLM Query 7 - SL 배치 원칙  
[31] NotebookLM Query 7 - SL 폭 조절  
[32] NotebookLM Query 7 - TP 배치 원칙  
[33] NotebookLM Query 7 - 분할 TP 전략  
[34] NotebookLM Query 7 - Risk-Reward Ratio  
[35] NotebookLM Query 8 - 상위 구조 확인  
[36] NotebookLM Query 8 - Entry Chain 단계별  
[37] NotebookLM Query 8 - Killzone 활용  
[38] NotebookLM Query 8 - 구조 동기화  
[39] NotebookLM Query 8 - 유동성 레벨 확인  
[40] NotebookLM Query 8 - 거시 구조 확인  
[41] NotebookLM Query 8 - Sweep 필수  
[42] NotebookLM Query 8 - 뉴스 이벤트 회피  
[43] NotebookLM Query 8 - SL 필수  
[44] NotebookLM Query 8 - 확인된 레벨 사용  
[45] NotebookLM Query 9 - FVG 판별  
[46] NotebookLM Query 9 - FVG 미충전 구간  
[47] NotebookLM Query 9 - FVG 수익 목표  
[48] NotebookLM Query 9 - FVG 종류  
[49] NotebookLM Query 9 - Order Block 정의  
[50] NotebookLM Query 9 - OB 재테스트  
[51] NotebookLM Query 9 - OB 구조 변곡점  
[52] NotebookLM Query 9 - OB 활용 사례  
[53] NotebookLM Query 10 - 1D 분석  
[54] NotebookLM Query 10 - 4H 분석  
[55] NotebookLM Query 10 - 1H 분석  
[56] NotebookLM Query 10 - 시나리오 수립  
[57] NotebookLM Query 10 - 계정 보호  
[58] NotebookLM Query 10 - 위험 관리  
[59] NotebookLM Query 10 - 거래별 위험  
[60] NotebookLM Query 10 - Killzone 실행  
[61] NotebookLM Query 10 - 심리 관리  
[62] NotebookLM Query 10 - 손실 관리

---

## 알고리즘 설계 수치 기준 (추가 쿼리)

### A. Market Structure Shift (MSS)와 Change of Character (CHoCH)의 정의와 판별 기준

Market Structure Shift (MSS) and Change of Character (CHoCH) are foundational concepts in ICT (Inner Circle Trading) framework that help traders identify key turning points and shifts in market direction. Here's a detailed breakdown:

**Market Structure Shift (MSS)**

A Market Structure Shift occurs when the market breaks a previously established structure. In simple terms, it's when price action violates the expected pattern of higher highs and higher lows (in an uptrend) or lower lows and lower highs (in a downtrend).

Key characteristics of MSS:
- In an uptrend: A lower low (LL) breaks the sequence of higher lows (HLs)
- In a downtrend: A higher high (HH) breaks the sequence of lower highs (LHs)
- MSS often precedes significant directional moves
- MSS can act as either a confirmation of trend reversal or a temporary pullback depending on subsequent price action

**Change of Character (CHoCH)**

CHoCH is a more subtle concept than MSS but equally important. It refers to a change in the "personality" or "character" of price movement without necessarily breaking structure yet. This could manifest as:
- A change in volatility (tighter or wider candles)
- A change in the speed of moves
- A change in the nature of pullbacks (shallower or deeper)
- A shift from directional to ranging behavior or vice versa

CHoCH is often considered an earlier warning signal compared to MSS, as it can precede the actual structure break.

**Discrimination Criteria**

1. **Structural Validity**: MSS requires a clear breach of a defined swing point (HL or LH). CHoCH may not involve such a clear breach but shows a qualitative change in behavior.

2. **Timeframe Dependency**: Both concepts are timeframe-dependent. An MSS on a 4-hour chart might not be an MSS on a 1-hour chart. Traders must be consistent in their chosen timeframe.

3. **Context**: 
   - An MSS in the direction of the higher timeframe trend is often more significant
   - An MSS against the HTF trend could be a corrective structure shift within the larger trend

4. **Volume and Velocity**: MSS and CHoCH are often accompanied by changes in volume and price velocity, which can help confirm the shift.

5. **Recovery**: After an MSS, price typically doesn't immediately reverse the overall trend. Instead, it often retests the broken level or consolidates before the next directional move.

**Practical Application**

In algorithmic trading:
- MSS detection requires identifying swing points and confirming breaks
- CHoCH detection may involve measuring volatility changes, average candle body size, or other character-based metrics
- Both concepts are best used as confluence factors alongside other analysis tools rather than standalone signals

> 📎 출처: [1] ICT Market Structure Concepts, [2] Elliott Wave and Market Structure Analysis, [3] Inner Circle Trader Framework Documentation

---

### B. Fair Value Gap (FVG)과 Order Block (OB)의 기하학적 정의와 형성 조건

**Fair Value Gap (FVG)**

An FVG is a gap in price action that represents an area where the market moved too quickly without allowing "fair" trading to occur. The formal definition involves three consecutive candles:

*Geometric Definition*:
- **Candle 1**: Initial move (bullish or bearish)
- **Candle 2**: A large move in the same direction that "skips" price levels
- **Candle 3**: A pullback candle that doesn't fully close the gap created between Candles 1 and 2

The FVG itself is the price range between:
- The high of Candle 1 and the low of Candle 2 (in a bullish FVG)
- The low of Candle 1 and the high of Candle 2 (in a bearish FVG)

*Formation Conditions*:
1. Three consecutive candles are required
2. There must be a clear directional impulsion (Candles 1 and 2)
3. Candle 3 must not completely fill the gap (some inefficiency remains)
4. The gap represents "imbalance" that the market typically seeks to correct
5. Candle 3's lack of closure suggests market participants rejected that level

**Order Block (OB)**

An Order Block is a price area where a significant amount of buying or selling pressure was likely concentrated. It represents a zone where institutional or smart money accumulated positions.

*Geometric Definition*:
- A bullish OB is typically a consolidated candle (or series of candles) preceding a strong impulsive move upward
- A bearish OB is a consolidated candle (or series) preceding a strong downward move
- The OB is identified by its range: from the open to the close of the candle(s) forming the block

*Formation Conditions*:
1. **Consolidation**: The OB candles show a relatively tight range (consolidation pattern)
2. **Breakout**: Immediately following the OB, there's an impulsive move (usually 2+ candle bodies) in a specific direction
3. **Directional Clarity**: The move must be clearly directional, not ranging
4. **Volume Confirmation**: Often accompanied by volume expansion on the breakout candle
5. **Retest Probability**: After being broken, OBs frequently act as support/resistance on retests

*Distinction Between FVG and OB*:
- FVG is about inefficiency (market moved too fast)
- OB is about liquidity accumulation (institutional activity)
- FVG focuses on the gap; OB focuses on the consolidation zone
- Both are "attractive" to price on retests, but for different reasons

> 📎 출처: [1] ICT Order Block and FVG Mechanics, [2] Market Microstructure and Institutional Trading, [3] Price Action Analysis Framework

---

### C. 유동성 레벨(Liquidity Level)의 분류, 배치 원리, 그리고 sweep 메커니즘

**Liquidity Level Classification**

Liquidity levels in ICT framework are classified based on their location and function:

1. **Macro Liquidity Levels**
   - Swing Highs and Swing Lows on higher timeframes (Daily, 4H)
   - Round numbers ($10,000, $50,000 for Bitcoin, for example)
   - Previous Support/Resistance zones
   - Areas where large volume has been traded historically

2. **Micro Liquidity Levels**
   - Recent swing points on lower timeframes (1H, 15M)
   - Intraday highs/lows
   - Order blocks and FVG zones

3. **Institutional Liquidity**
   - Levels where banks and large traders are known to have positioned
   - Often identified by significant wicks and rejections
   - Characterized by quick reversals after touching the level

4. **Retail Liquidity**
   - Common round numbers ($50k, $100k, etc.)
   - Psychological levels
   - Often targeted for quick "grabs" by smart money

**Deployment Principles (배치 원리)**

1. **Confluence Stacking**: Multiple liquidity levels in close proximity create stronger zones
2. **Timeframe Hierarchy**: HTF liquidity is typically more significant than LTF liquidity
3. **Distance from Current Price**: Liquidity levels become more relevant as price approaches them
4. **Historical Significance**: Levels that have been retested multiple times hold more weight
5. **Volume Profile Integration**: Areas with high volume in the past often hold liquidity

**Sweep Mechanism (스윕 메커니즘)**

A liquidity sweep (or "sweep" or "grind") occurs when price moves into a liquidity zone, triggers trades (often stop losses), creates a false breakout, and then reverses.

*Mechanical Process*:
1. Price approaches a liquidity level (support/resistance or extreme)
2. Initial breakout occurs, creating the appearance of a new trend
3. Stops above/below the level are triggered (retail traders' stops)
4. Smart money collects this liquidity
5. Price reverses back through the level and continues in the opposite direction

*Characteristics of a Sweep*:
- **Wick Formation**: Often leaves a wick extending beyond the liquidity level
- **Rapid Reversal**: The candle closes back within the previous structure
- **Low Time Duration**: Sweeps typically happen on lower timeframes within 1-4 candles
- **Volume Spike**: Often accompanied by volume expansion on the sweep candle
- **Pattern Confirmation**: A sweep is often followed by a strong directional move away from the level

*Swing Liquidity Sweep (SSL/BSL Sweep)*:
- **Buy-Side Liquidity (BSL) Sweep**: Price sweeps above a swing high (takes out sell stops), then reverses
- **Sell-Side Liquidity (SSL) Sweep**: Price sweeps below a swing low (takes out buy stops), then reverses
- These sweeps are key in identifying potential reversal points with high probability

*Algorithmic Detection of Sweeps*:
1. Identify liquidity level (HH, LL, round numbers, previous extremes)
2. Monitor for wick beyond the level (not just touches)
3. Confirm rapid reversal back through the level
4. Volume expansion as confirmation
5. Subsequent directional move as validation

> 📎 출처: [1] ICT Liquidity Mapping and Sweep Mechanics, [2] Market Microstructure: Institutional Order Flow, [3] Smart Money Concepts in Trading

---

### D. Displacement 캔들의 정의와 질적 기준

**Definition of Displacement Candle**

In ICT and Smart Money Concepts, a "Displacement Candle" (also called an "Imbalance Candle" or "Impulsive Candle") is a candle that moves price significantly in one direction without allowing much retracement or consolidation within or immediately after it.

*Core Characteristics*:
1. **Large Body Relative to Context**: The candle's body (open to close distance) is significantly larger than the surrounding candles
2. **Directional Conviction**: The candle closes in the direction of the move (not indecisive)
3. **Limited Wick Opposition**: Minimal wick in the opposite direction of the move (or no wick at all)
4. **Absence of Consolidation**: The next candle(s) do not consolidate or move sideways; instead, they continue the direction or pull back minimally

**Qualitative Criteria (vs. Quantitative Thresholds)**

Unlike some technical analysis frameworks, ICT emphasizes *qualitative* assessment of displacement rather than rigid percentage rules (e.g., "candle must be 200% larger than the 20-period average"). Here's why:

1. **Context Dependency**: A 50-pip move on EUR/USD is different from a 50-pip move on Bitcoin. Context matters.
2. **Volatility Adjustment**: High-volatility vs. low-volatility markets require different interpretations.
3. **Timeframe Relativity**: A "large" candle on a 4H chart is evaluated relative to the range on that timeframe, not an absolute value.

**Qualitative Assessment Framework**:

1. **Visual Prominence**: Does the candle "stand out" visually on the chart compared to recent candles?
2. **Close Proximity to Extreme**: Does the candle close near its high (bullish) or low (bearish)?
3. **Range Expansion**: Is there a clear expansion in the range compared to the prior 2-3 candles?
4. **Momentum Continuation**: Do the next 1-2 candles continue in the same direction, or do they reverse?
5. **Wick Rejection**: Is there minimal wick in the opposite direction, indicating rejection of the opposite extreme?

**Displacement Candle Subtypes**:

1. **Initial Displacement**: The first candle in an impulsive sequence that breaks out of consolidation
2. **Continuation Displacement**: A candle within an ongoing trend that shows accelerated movement
3. **Reversal Displacement**: A displacement candle that occurs at a potential reversal point and signals a change in direction

**Why Qualitative Assessment Matters**:

- **Flexibility Across Assets**: Bitcoin, forex, stocks, and commodities all behave differently in absolute terms
- **Adaptability to Regime Changes**: During high volatility, a "large" candle is different from low-volatility periods
- **Reduces False Signals**: Percentage-based rules can trigger on every 2% move in some markets, while missing genuine signals in others
- **Aligns with Smart Money Activity**: Institutional traders don't trade percentage ranges; they trade price action and structure

**Algorithmic Implementation Hint**:

Rather than coding a fixed percentage threshold, a more adaptive approach might:
- Calculate the rolling average range of recent candles
- Flag candles where the range exceeds 1.5x to 2.5x the rolling average (adjusted by volatility)
- Combine with other criteria: close proximity to extreme, next candle continuation, volume confirmation
- Allow for manual override and contextual tuning by the trader

> 📎 출처: [1] ICT Displacement Candle and Impulsive Movement, [2] Price Action: Qualitative vs. Quantitative Analysis, [3] Smart Money Concepts: Order Flow and Candle Interpretation

---

### E. Breaker Block의 정의와 형성 조건, 그리고 재테스트 규칙

**Definition of Breaker Block**

A Breaker Block is a price level or zone that represents an area where a significant impulsive move broke through a previous support or resistance level. Unlike a simple break, a Breaker Block has specific criteria and carries strong implications for future price action.

*Core Concept*:
- A Breaker Block marks the zone where price "broke" a structure (e.g., broke a swing low or swing high)
- It represents the candle(s) that actually executed the break
- The zone itself becomes a powerful attraction point for price on subsequent retests

**Formation Conditions**

1. **Pre-Break Structure**: There must be an established support or resistance level (swing point, order block, or structural level)
2. **Impulsive Break**: The break must be an impulsive move (displacement candle or series of displacement candles), not a slow penetration
3. **Directional Commitment**: The break must close beyond the level; not just a wick touch
4. **Range Definition**: The Breaker Block is the range of the candle(s) that executed the break
   - In a bullish break: from the open of the breaking candle to its close (or the range of multiple breaking candles)
   - In a bearish break: similarly defined by the breaking candle(s)

5. **Subsequent Behavior**: After the break, price should NOT immediately reverse and fill back through the level; instead, it should move away from it for at least a few candles

**Identification Steps**:

1. Identify the level being broken (previous swing high/low, resistance/support)
2. Locate the candle(s) that execute the break (impulsive move through the level)
3. Mark the range of the breaking candle(s) as the Breaker Block zone
4. Confirm that price moves away from the level after the break (not immediate reversal)

**Retest Rules (재테스트 규칙)**

After a Breaker Block is formed, price typically returns to retest the zone. The behavior during this retest is crucial:

1. **Retest Likelihood**: Breaker Blocks are frequently retested within the next 5-20 candles (depending on timeframe)
2. **Retest Entry Trigger**: 
   - A retest often provides a high-probability entry point
   - Price should approach the Breaker Block zone but ideally not fully break back through it
   - A wick into the zone followed by a closure outside is a "successful" retest for directional continuation

3. **Invalidation Conditions**:
   - If price fully closes back beyond the Breaker Block on the retest, the break is considered invalidated
   - The structure may revert to the original level as support/resistance
   - This suggests the initial break was a false/failed breakout

4. **Confluence on Retest**:
   - If the retest coincides with other structures (FVG, order block, liquidity level), the probability of reversal increases
   - A failed retest (price touches but bounces) is stronger than a retest that closes through the zone

5. **Time-Based Rules**:
   - An immediate retest (within 1-2 candles) is less reliable than a retest after a few candles
   - Delayed retests (after 10+ candles) can still occur and remain valid

**Example Scenario**:

- Price is in a downtrend and is below a swing low support level
- An impulsive candle breaks UP above that swing low
- The range of that breaking candle becomes the Breaker Block
- Price moves higher for 3-5 candles
- Price then retraces back down toward the Breaker Block zone
- If price touches the zone but doesn't close back below it (closes above), this is a successful retest, and continuation higher is likely
- If price fully closes back below the Breaker Block, the break is invalidated, and the original support level resumes its role

**Algorithmic Detection**:

1. Identify structural levels (swings)
2. Monitor for impulsive breaks through these levels
3. Mark the breaking candle(s) range as a Breaker Block
4. Track subsequent retests
5. Flag retest success/failure based on close position relative to the Breaker Block range

> 📎 출처: [1] ICT Breaker Block and Institutional Order Targeting, [2] Smart Money Concepts: Order Targeting and Liquidity Zones, [3] Price Action: Break Invalidation Rules

---

### F. 4시간봉(HTF)과 1시간봉(LTF) 사이의 정렬(Alignment) 임계값과 우선순위

**HTF-LTF Alignment Concept**

In ICT and multi-timeframe analysis, alignment between a Higher Timeframe (HTF, e.g., 4-hour) and a Lower Timeframe (LTF, e.g., 1-hour) is crucial for high-probability trading setups. Alignment refers to the confluence of directional bias, structural levels, and momentum across different timeframes.

**Alignment Categories**

1. **Perfect Alignment**
   - HTF trend direction and LTF trend direction are identical
   - HTF support/resistance levels align with LTF support/resistance
   - HTF and LTF are both showing displacement or impulsive candles in the same direction
   - Probability: Highest

2. **Partial Alignment**
   - HTF and LTF agree on the primary direction, but LTF is in a corrective phase
   - HTF shows a clear trend; LTF is consolidating within that trend
   - Probability: Moderate-to-High

3. **Misalignment**
   - HTF and LTF are pointing in opposite directions
   - Trade only on the HTF bias with extreme caution or avoid entirely
   - Probability: Lower (higher risk of choppy, range-bound price action)

4. **Neutral Alignment**
   - Both HTF and LTF are in consolidation/ranging
   - Directional probability is lower
   - Probability: Lower (but higher probability of mean reversion trades within the range)

**Threshold Criteria (Absolute vs. Percentage-Based)**

*ICT Framework Approach: Absolute Thresholds (Not Percentage-Based)*

Rather than using percentage-based rules (e.g., "if LTF is up 3% and HTF is up 5%, they're aligned"), ICT uses *absolute structural alignment*. Here's why:

1. **Bitcoin vs. Altcoins**: Bitcoin at $65,000 moving 2% is different from a token at $0.50 moving 2%
2. **Volatility Variance**: High-volatility periods require different interpretation than low-volatility
3. **Market Regime**: Bull markets, bear markets, and consolidation phases have different dynamics

**Absolute Alignment Thresholds**:

1. **Directional Alignment**: 
   - ✓ Both HTF and LTF showing higher highs & higher lows = ALIGNED (bullish)
   - ✓ Both HTF and LTF showing lower lows & lower highs = ALIGNED (bearish)
   - ✗ HTF showing higher highs but LTF showing lower lows = MISALIGNED

2. **Structural Level Alignment**:
   - ✓ A recent swing low on HTF (4H) acts as support on LTF (1H) = ALIGNED
   - ✓ A recent swing high on HTF (4H) acts as resistance on LTF (1H) = ALIGNED
   - ✗ HTF swing low is not being respected on LTF = MISALIGNED

3. **Order Block / FVG Alignment**:
   - ✓ An HTF order block contains an LTF order block = STRONG CONFLUENCE
   - ✓ An HTF FVG is being retested by an LTF structure = ALIGNED
   - ✗ HTF and LTF orders blocks are in different zones = MISALIGNED

4. **Displacement & Momentum Alignment**:
   - ✓ Both HTF and LTF showing displacement candles in the same direction = ALIGNED
   - ✓ Both timeframes breaking structure in the same direction = ALIGNED
   - ✗ HTF breaking up while LTF is breaking down = MISALIGNED

**Priority Rules (우선순위)**

1. **HTF Bias Overrides LTF Details**
   - If HTF is in a clear uptrend, prefer to trade long on LTF pull backs
   - If HTF is in a downtrend, prefer to trade short on LTF bounces
   - LTF trade setups against the HTF bias carry higher risk

2. **Alignment Probability Hierarchy** (from highest to lowest probability):
   - **Tier 1**: HTF trending + LTF break in HTF direction at HTF level = 75%+ probability ✓✓
   - **Tier 2**: HTF trending + LTF continuation at HTF level = 60-75% probability ✓
   - **Tier 3**: HTF trending + LTF consolidation at HTF level = 50-60% probability ~
   - **Tier 4**: HTF trending but LTF opposing = 35-50% probability ✗
   - **Tier 5**: Both HTF & LTF ranging = 40-50% probability ~

3. **Decision Tree**:
   ```
   Is HTF in a clear trend?
   ├─ YES: 
   │  ├─ Is LTF structure aligned with HTF bias?
   │  │  ├─ YES: Trade in HTF direction → HIGHEST PROBABILITY
   │  │  └─ NO: Avoid or use tighter stops
   │  └─ Is LTF in a pull back or retest of HTF level?
   │     ├─ YES: Consider entry on retest bounce
   │     └─ NO: Wait for LTF structure alignment
   └─ NO (HTF ranging):
      ├─ Look for HTF extremes (support/resistance)
      └─ Use LTF structure for entry/exit, but reduce risk due to lower HTF context
   ```

4. **Confluence Weighting**:
   - HTF bias: 50% weight in decision-making
   - LTF structure alignment: 30% weight
   - Order blocks / FVGs (across timeframes): 20% weight
   - Other factors (volume, volatility): Additional context

5. **When to Trade Against HTF**:
   - Only during HTF consolidation or when LTF shows extreme extremes (LL that breaks previous structure significantly)
   - Risk must be managed tightly (smaller position size, tighter stops)
   - Probability is lower, but reward-to-risk can still be positive if managed correctly

**Practical Example**:

- **HTF (4H)**: Bullish trend with recent higher low at $65,000
- **LTF (1H)**: Price pulls back to $64,800 and forms an order block, then breaks down to $64,500 (below HTF higher low)
- **Assessment**: Misalignment (LTF structure breaks HTF support)
  - Action: Either avoid the trade or use a very tight stop loss ($64,400) with small position
  - Probability is lower due to misalignment

---

- **HTF (4H)**: Bullish trend, recent higher low at $65,000
- **LTF (1H)**: Price pulls back to $64,900, forms an order block, then breaks back up through $65,000
- **Assessment**: Perfect alignment (LTF respects HTF level and breaks in HTF direction)
  - Action: High-probability entry with stop below $64,500, larger position size
  - Probability is high due to perfect alignment

> 📎 출처: [1] ICT Multi-Timeframe Analysis and Alignment, [2] Institutional Order Targeting Across Timeframes, [3] Smart Money Concepts: HTF Context and LTF Entry Execution, [4] Market Structure: Threshold-Based Decision Making, [5] Probability Weighting in Confluence Analysis

---

---

### G. 스코어카드(Scorecard) — 컨플루언스 랭킹 시스템

ICT 이론에서 **스코어카드(Scorecard)**란 수많은 차트 신호(MSS, FVG 등) 중에서 가짜 함정을 걸러내고 승률이 높은 '진짜' 자리를 찾아내기 위해 진입 셋업에 객관적인 등급(점수)을 매기는 컨플루언스 랭킹(Confluence Ranking) 시스템이다.

기관 트레이더들은 모든 신호에 똑같은 돈을 걸지 않으며, 이 점수표를 기준으로 진입 여부와 비중을 결정한다. 스코어카드는 진입 전 멈춰 서서 스스로에게 던져야 할 5가지 핵심 질문으로 구성된다.

#### 스코어카드 5대 평가 항목

**1. 구조 (Structure): 상위 프레임(HTF) 추세와 같은 방향인가? (+1점)**

진입 방향이 거대한 숲인 상위 시간대의 추세와 일치하는지 확인한다.

**2. 시간 (Time): 현재 알고리즘이 켜진 '킬존(Killzone)'인가? (+1점)**

런던 오픈, 뉴욕 오픈 등 알고리즘이 활발하게 작동하는 킬존 시간대라면 1점을 얻는다. 킬존 밖의 애매한 시간대라면 0점이다.

**3. 가격 (Price): 최적 진입 영역인 OTE(Optimal Trade Entry)인가? (+1~-1점)**

단순한 50% 중심선 아래가 아니라 피보나치 **0.62 ~ 0.79 사이의 가장 최적화된 할인/할증 구간(OTE)**에 들어왔다면 +1점을 받는다.

- 얕은 되돌림(50~62%): +0.5점
- 매수 셋업인데 프리미엄 구간에 위치: 진입 금지를 뜻하는 -1점

**4. 배열 (PD Array): 강력한 도구들이 중첩(Cluster)되어 있는가? (+1~+2점)**

오더블록, FVG, 브레이커 등 다양한 POI가 한 가격대에 모여 있는지 확인한다.

| 중첩 상태 | 점수 |
|-----------|------|
| FVG 단일 근거 | 0점 |
| 오더블록 + FVG 등 2개 중첩 | +1점 |
| 3개 이상 중첩 or 유니콘 셋업(브레이커+FVG) | +2점 (콘크리트 바닥) |

**5. 유동성 (Liquidity): 방금 유동성 스윕(Sweep)을 만들었는가? (+1점)**

진입 구조가 만들어지기 직전에 단기 고점/저점을 찔러 개미들의 손절 물량을 터트리는 '스윕'이 선행되었는지 확인한다.

#### 스코어카드 실전 활용 결과

겉보기에는 동일하게 시장 구조 변화(MSS)와 FVG가 나타난 자리라도 스코어카드에 대입해 보면 질적인 차이가 확연히 드러난다.

| 구분 | 총점 | 특징 | 결과 |
|------|------|------|------|
| A자리 (함정 패턴) | 1점 | 아시아 세션 / 스윕 없음 / 프리미엄 존의 FVG 단일 근거 | 힘없이 뚫리고 손절 발생 |
| B자리 (S급 타점) | 5점 | 뉴욕장 킬존 / OTE 도달 / 유동성 스윕 직후 / 오더블록+FVG 중첩 | 알고리즘이 정확히 터치 후 추세 지속 |

매매 버튼을 누르기 전 이 스코어카드 체크리스트를 확인하는 습관을 들이면, 불필요한 뇌동매매를 줄이고 차트에 등급을 매겨 가장 확실한 기회에서만 방아쇠를 당기는 필터링 기술이 완성된다.

> 📎 출처: ICT Scorecard / Confluence Ranking System

---

## 구조 다이어리 작성법

### 기본 6단계 템플릿

실제 분석 능력을 키우기 위한 복기 훈련 방법론이다. 의미 있는 가격 움직임이 나온 차트를 골라 아래 6단계를 순서대로 기록한다.

#### 1단계 — 차트 선정 및 캡처

분석할 의미 있는 가격 움직임이 나온 차트를 선정한다.

#### 2단계 — 구조 분석

가장 최근의 유의미한 외부 스윙 구조를 작도한 뒤, 현재 내가 보는 구간이 **상승 추세인지, 하락 추세인지, 횡보장인지** 한 줄로 명확히 기록한다.

#### 3단계 — 유동성 식별

가격이 최근에 고의로 찔러서 휩쓴(Sweep) 유동성이 있는지 파악하고, 그것이 **매수측 유동성(BSL)** 인지 **매도측 유동성(SSL)** 인지 라벨링한다.

#### 4단계 — 핵심 증거 찾기

유동성을 휩쓴 직후 반대 방향으로 강력한 **디스플레이스먼트(Displacement)** 가 발생했는지 체크하고, 이 급격한 이동이 남긴 빈 공간인 **FVG** 구간을 차트에 표시한다.

#### 5단계 — 구조 변화 확인

디스플레이스먼트 파동이 직전 주요 스윙을 깨뜨리며 **MSS(시장 구조 변화)** 혹은 **CHoCH** 신호를 만들어냈는지 확인하고, 해당 돌파 지점을 선으로 긋는다.

#### 6단계 — 스토리텔링 (복기 완성)

위에서 파악한 스윕, 디스플레이스먼트, 구조 변화 등의 단서를 모두 종합하여, **기관이 어떤 의도로 움직였는지** 한두 문장의 '스토리'로 요약하여 적는다.

---

### 학습 진도에 따른 다이어리 심화 작성법

ICT 개념에 익숙해질수록 다이어리의 항목들을 고도화하여 타점을 더욱 정교하게 다듬어야 한다.

#### 심화 1 — 내러티브와 딜링 레인지 추가

다음 두 가지 질문을 추가해 차트 위에 알고리즘의 내러티브(경로)를 그린다.

- "나의 현재 거래 범위(ERL)의 양 끝단은 어디인가?"
- "지금 가격이 최종 목적지인 외부 유동성(ERL)을 향해 가는 중인가, 아니면 연료를 채우기 위해 내부 유동성(IRL)인 FVG/OB로 되돌아오는 중인가?"

#### 심화 2 — FVG 세밀화 및 등급 추적

단순한 FVG 표기를 넘어 다음을 기록한다.

| 항목 | 내용 |
|------|------|
| 박스 + CE | FVG 박스를 그리고 50% 중심선(CE) 가격을 정확히 기입 |
| 등급 평가 | 명확한 MSS를 유발했는지, P/D Zone 올바른 위치인지 → A+ 여부 자체 평가 |
| 결과 추적 | 리밸런스(지지/저항 성공) 여부, 또는 몸통 돌파 후 **IFVG(역할 반전)** 여부를 반드시 기록 |

#### 심화 3 — 브레이커 블록과 유니콘 셋업 결합

MSS가 발생했을 때 아래 항목을 추가로 점검한다.

- 방어에 실패하고 뚫려버린 오더블록(**브레이커 블록**) 이 있는지 확인
- 그 위치에 새로운 FVG가 겹쳐 생성되어 강력한 **유니콘(Unicorn) 셋업** 을 만들었는지 확인

> 브레이커 블록 + FVG 중첩 = 유니콘 셋업. 스코어카드 최고 등급(A+)에 해당하는 타점이다.

> 📎 출처: ICT Structure Diary / Journaling Method

---

**끝**
