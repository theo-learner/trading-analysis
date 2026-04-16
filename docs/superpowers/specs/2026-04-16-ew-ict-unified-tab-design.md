# EW+ICT 통합 분석 탭 설계

**날짜**: 2026-04-16  
**상태**: 승인됨  
**대상 파일**: `reports/YYYYMMDD_dashboard.html`

---

## 배경 및 문제 정의

기존 대시보드의 Elliott Wave / ICT 탭은 완전히 텍스트 기반으로, 아래 4가지 문제가 있었다:

1. 텍스트가 너무 많아 핵심 정보(방향·진입·타겟·무효화)를 찾기까지 시간이 걸림
2. 4개 페어를 동시에 비교하기 어려움
3. 강세/약세 방향성 바이어스를 한 눈에 파악하기 어려움
4. 멀티 타임프레임(1D/4H/1H) 정렬 상태를 확인하기 어려움

**핵심 인사이트**: EW와 ICT 분석이 결국 도달해야 하는 정보는 동일하다 — 방향(bias), 진입 레벨(POI/OB), 타겟(유동성), 무효화 조건. 두 탭으로 분리하면 컨플루언스 확인 시 탭 전환이 필요해 비효율적이다.

---

## 설계 결정

### 1. 탭 통합

기존 `Elliott Wave` 탭과 `ICT` 탭을 **`분석` 탭 하나로 통합**한다.

**탭 순서**: Overview / Macro / **분석** / Orderflow / Scenarios / Risk

### 2. 탭 내부 레이아웃

페어 선택(BTC/ETH/SOL/HYPE) 후, 선택된 페어의 분석 카드를 표시한다.

```
[BTC] [ETH] [SOL] [HYPE]

┌─────────────────────────────────────────┐
│ BTCUSDT                     ▲ LONG     │  ← 종합 바이어스 헤더
├─────────────────────────────────────────┤
│        타임프레임 정렬 (3칸)             │  ← Section 1
│  1D: ▲상승 / EW ABC→W1 / ICT MSS      │
│  4H: ▲상승 / EW W3진행 / ICT BOS      │
│  1H: ↔중립 / EW 소조정 / ICT POI대기  │
├────────────────────┬────────────────────┤
│  EW 파동 스텝      │  ICT 2×2 그리드    │  ← Section 2
│  W1✓-W2✓-W3◀-W4-W5│  구조 / POI        │
│  확인 $XX,XXX      │  유동성 / 킬존     │
│  무효화 $XX,XXX    │  SMT 배너          │
├─────────────────────────────────────────┤
│  컨플루언스 요약 태그                    │  ← Section 3
│  [EW W3+ICT BOS 일치 ✓] [OB=W2되돌림] │
├─────────────────────────────────────────┤
│  ▸ 전체 분석 텍스트 보기 (토글)          │  ← Section 4
└─────────────────────────────────────────┘
```

#### Section 1: 타임프레임 정렬 바

- 3칸 flex 레이아웃 (1D / 4H / 1H)
- 각 칸: 방향 배지(▲/▼/↔) + EW 파동 요약 + ICT 구조 요약
- 색상: 상승 `#4ade80` 배경, 하락 `#f87171` 배경, 중립 `#fbbf24` 배경

#### Section 2: EW 파동 스텝 + ICT 그리드 (데스크탑 2열)

**TF 선택**: Section 2 전체는 하나의 TF 탭(1D / 4H / 1H, 기본 4H)을 공유한다. EW 스텝과 ICT 그리드가 항상 동일한 TF를 보여준다. Section 1의 정렬 바는 TF 전환 없이 항상 3개를 동시에 표시한다.

**EW 파동 스텝 (좌)**:
- 수평 스텝 다이어그램: W1 → W2 → W3 → W4 → W5
- 완료된 파동: `#4ade80` 테두리/배경
- 현재 파동: `#f59e0b` 테두리/배경 + `◀` 마커
- 미래 파동: `#2a2f3e` 회색
- 하단: 확인 레벨(초록), 무효화 레벨(빨강)

**ICT 2×2 그리드 (우)**:
- 구조 (`#4ade80`): BOS/MSS/CHoCH 태그
- POI (`#f59e0b`): 진입 레벨 수치 + OB/FVG 유형
- 유동성 (`#22d3ee`): BSL 상방 / SSL 하방
- 킬존 (`#a78bfa`): 시간대 + 실버불릿
- SMT 배너 (`#fb923c`): 페어 간 발산 여부

#### Section 3: 컨플루언스 요약

- EW와 ICT가 수렴하는 포인트를 배지 형태로 표시
- 데이터: `confluence` 배열 (문자열 리스트)
- 예: `["EW W3 상승 + ICT BOS 일치 ✓", "Bull OB = W2 되돌림 구간"]`

#### Section 4: 텍스트 토글

- 기존 `detail`, `structure`, `poi` 등 서술형 텍스트 보존
- 기본 숨김, 클릭 시 펼침

---

## 데이터 스키마 변경

### PAIRS 상수 기존 구조

```javascript
{
  ew: {
    "1D": { count, detail, confirmation, invalidation }
  },
  ict: {
    "1D": { structure, poi, liquidity, killzone, smt }
  }
}
```

### 추가 필드

```javascript
{
  bias: "long" | "short" | "neutral",  // 페어 루트, 종합 방향
  confluence: ["string", ...],          // 페어 루트, 수렴 포인트 배열

  ew: {
    "1D": {
      // 기존 유지
      count, detail, confirmation, invalidation,
      // 신규
      direction: "long" | "short" | "neutral",
      current_wave: "W1" | "W2" | "W3" | "W4" | "W5" | "ABC" | "C",
      completed_waves: ["W1", "W2"],  // 완료된 파동 목록
      target: number | null,
    }
  },
  ict: {
    "1D": {
      // 기존 유지
      structure, poi, liquidity, killzone, smt,
      // 신규
      structure_tag: "BOS" | "MSS" | "CHoCH" | null,
      structure_direction: "bullish" | "bearish" | "neutral",
      poi_level: number | null,       // 진입 레벨 수치
      bsl: number | null,             // BSL 수치
      ssl: number | null,             // SSL 수치
    }
  }
}
```

**원칙**: 신규 필드가 없거나 `null`이면 해당 카드는 "—" 표시. 추정값 생성 금지.

---

## 모바일 분기

- 타임프레임 정렬 바: 3칸 유지 (각 칸 너비 균등)
- EW 스텝 + ICT 그리드: `isMobile ? '1fr' : '1fr 1fr'` (세로 스택)
- EW 파동 스텝: `overflow-x: auto`로 가로 스크롤 허용
- 페어 선택: 기존 accordion 패턴 유지 (`useState(selectedPair)`)
- 컨플루언스 태그: `flex-wrap: wrap`

---

## 구현 시 주의사항

1. **기존 EW/ICT 탭 제거**: `tabs` 배열에서 `Elliott Wave`, `ICT` 탭 항목 제거하고 `분석` 탭 추가
2. **CLAUDE.md 업데이트 필요**: 탭 구조 규칙에서 EW/ICT 탭 분리 → 통합 탭으로 변경
3. **기존 데이터 호환**: 신규 필드 없이 기존 필드만 있어도 텍스트 토글 영역에서는 정상 동작
4. **컨플루언스 자동화 불가**: 컨플루언스 배열은 분석 시 Claude가 수동으로 작성 (자동 계산 아님)
