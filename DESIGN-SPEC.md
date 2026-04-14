# Crypto Futures Analysis Dashboard — Design Technical Spec

> **대상**: UI/UX 디자이너 (직접 구현)  
> **기준일**: 2026-04-11  
> **목적**: 현재 구현 상태 전달 + 개선 설계를 위한 기술 컨텍스트 제공

---

## 1. 시스템 구조

### 1-1. 전체 아키텍처
```
Vercel (정적 호스팅)
└── reports/
    ├── index.html          ← 날짜 선택 셸 페이지 (외부 nav)
    ├── 20260411_dashboard.html  ← 분석 대시보드 (독립 HTML)
    └── YYYYMMDD_dashboard.html  ← 날짜별로 자동 생성
```

- `index.html`이 날짜 네비게이션 바를 제공하고, 선택한 대시보드를 **iframe으로 임베드**
- 각 `*_dashboard.html`은 독립 실행 가능한 완결 파일 (서버 불필요)
- 대시보드는 매일 로컬 파이프라인이 자동 생성 → GitHub push → Vercel 자동 배포

### 1-2. 기술 스택 (현재)
| 항목 | 현재 | 비고 |
|------|------|------|
| UI 프레임워크 | React 18 (CDN unpkg) | 빌드 도구 없음 |
| 트랜스파일 | Babel Standalone (CDN) | 런타임 컴파일 — 초기 로딩 느림 |
| 스타일링 | Inline style (JS 객체) | Tailwind 없음, CSS 클래스 없음 |
| 상태 관리 | `useState` (탭 선택만) | 데이터는 전부 정적 const |
| 데이터 소스 | HTML 내 하드코딩 const | API 없음, 빌드 시 데이터 삽입 |

---

## 2. 데이터 스키마

분석 결과는 `PAIRS` 배열로 대시보드에 하드코딩된다.  
디자이너는 이 구조를 기반으로 UI 컴포넌트를 설계해야 한다.

### 2-1. PAIRS 배열 (페어당 1개 객체, 총 4개)
```
PAIRS[i] = {
  pair:      string          // "BTCUSDT" | "ETHUSDT" | "SOLUSDT" | "HYPEUSDT"
  price:     number          // 현재가 (USD)
  change24h: string          // "+17.52%"
  bias:      string          // "신중 강세" | "약세" | "중립" | "단기 과열"
  biasColor: hex             // 색상 코드

  rsi: { "1D": number, "4H": number, "1H": number }
  cci: { "1D": number, "4H": number, "1H": number }
  oi:      string            // OI 변화율 "+12.3%"
  funding: string            // "+0.012%"

  ew: {
    primary:      string     // Primary EW count 설명 (1-2줄 텍스트)
    alternate:    string     // Alternate count
    invalidation: string     // 무효화 조건 (레드 강조)
    fibs: [ { label: string, level: number } ]  // 최대 3개
  }

  ict: {
    bsl: number[]            // Buy-Side Liquidity 레벨 배열
    ssl: number[]            // Sell-Side Liquidity 레벨 배열
    ob: {
      bull: [number, number] // 하단-상단 범위
      bear: [number, number]
    }
    fvg: {
      bull: [number, number]
      bear: [number, number]
    }
    premDisc: string         // Premium/Discount 설명 텍스트
  }

  vrvp: {
    poc: number              // Point of Control
    lvn: [number, number]    // Low Volume Node 범위
    hvn: [number, number]    // High Volume Node 범위
  }

  orderflow: {
    heatmap: string          // 히트맵 해석 텍스트
    cvd:     string          // CVD 상태 텍스트
    context: string          // 종합 시장 해석
  }

  scenarios: [               // 항상 3개 (A/B/C)
    {
      label: string          // "A — 단기 조정 후 재상승"
      prob:  number          // 0-100 (합계 100)
      color: hex
      entry: string
      sl:    string
      tp:    string[]        // 1-3개
      rr:    string          // "1:2.5"
    }
  ]
}
```

### 2-2. Risk 탭 전용 데이터 (현재 하드코딩)
```
plans[i] = {
  pair:       string
  priority:   1-4            // 거래 우선순위
  type:       "Long" | "Short" | "Watch"
  color:      hex
  confidence: number         // 0-100 (신뢰도 %)
  setup:      string         // 셋업 근거
  entry:      string
  sl:         string
  tp1, tp2:   string
  rr:         string
  note:       string         // 주의사항
}

riskFactors[i] = {
  factor: string
  desc:   string
  level:  "High" | "Medium" | "Low"
  color:  hex
}
```

---

## 3. 디자인 시스템 (현재)

### 3-1. 컬러 팔레트
| 토큰 | Hex | 용도 |
|------|-----|------|
| `bg` | `#0b0e14` | 페이지 배경 |
| `panel` | `#131720` | 섹션/헤더 배경 |
| `card` | `#1a1f2e` | 카드 배경 |
| `border` | `#2d3348` | 테두리 |
| `textPrimary` | `#e8eaed` | 주요 텍스트 |
| `textSecondary` | `#9ca3af` | 보조 텍스트, 레이블 |
| `bull` | `#4ade80` | 강세, 매수, TP |
| `bear` | `#f87171` | 약세, 매도, SL, 위험 |
| `neutral` | `#fbbf24` | 중립, 주의 |
| `confluence` | `#a78bfa` | 수렴 포인트, Fib 레벨, R:R |
| `cvdPos` | `#22d3ee` | CVD 양수, OI 표시 |
| `cvdNeg` | `#fb923c` | CVD 음수 |
| `heatHigh` | `#f59e0b` | 히트맵 고밀도, VRVP POC |

> **규칙**: 알파값은 hex suffix로만 처리 (`#4ade8022` = 13% opacity).  
> Tailwind opacity modifier (`text-green-400/50`) 사용 금지.

### 3-2. 타이포그래피 (현재 미정의, 암묵적 규칙)
| 용도 | 크기 | 굵기 |
|------|------|------|
| 페어명 헤더 | 18px | 800 |
| 현재가 | 24px | 700 |
| 탭 레이블 | 13px | 600 |
| 카드 타이틀 (SectionTitle) | 11px | 700, uppercase, letter-spacing 1px |
| 본문 텍스트 | 13px | 400 |
| 보조 레이블 | 10-11px | 400 |
| 수치 강조 | 12-14px | 700 |

### 3-3. 간격/반경
| 항목 | 값 |
|------|-----|
| 카드 padding | 16px |
| 카드 border-radius | 8px |
| 내부 패널 padding | 10-12px |
| 내부 패널 border-radius | 6px |
| gap (그리드) | 10-16px |
| Badge border-radius | 4px |

---

## 4. 컴포넌트 인벤토리 (현재)

### 공통 컴포넌트
| 이름 | 역할 | Props |
|------|------|-------|
| `Badge` | 인라인 상태 뱃지 | `children`, `color` |
| `Card` | 컨텐츠 래퍼 (카드) | `children`, `style?` |
| `SectionTitle` | 섹션 레이블 (대문자) | `children` |
| `RSIBar` | RSI 값 + 진행 바 | `label`, `value` |

### 탭별 컴포넌트
| 이름 | 역할 |
|------|------|
| `OverviewTab` | 전체 요약 (4페어 카드) |
| `EWTab` | Elliott Wave 상세 |
| `ICTTab` | ICT/SMC 레벨 |
| `OrderflowTab` | OI/CVD/히트맵 |
| `ScenariosTab` | A/B/C 시나리오 |
| `RiskTab` | 리스크 관리 플랜 |

---

## 5. 탭별 레이아웃 상세

### Tab 1 — Overview
```
[2-column grid]
  Card (각 페어) {
    row: 페어명 + 현재가 + 24h변화 | Bias Badge
    RSI Bars: 1D / 4H / 1H (진행 바)
    [2-column] OI 변화 | Funding Rate
  }
```

### Tab 2 — Elliott Wave
```
[vertical list]
  Card (각 페어) {
    row: 페어명 | Bias Badge
    [2-column] Primary Count | Alternate Count
    Invalidation (빨간 배경 배너)
    Fibonacci Levels (chip 그룹)
  }
```

### Tab 3 — ICT/SMC
```
[vertical list]
  Card (각 페어) {
    [3-column] BSL 목록 | SSL 목록 | VRVP POC
    [2-column] Bull OB 범위 | Bear OB 범위
    Premium/Discount 배너
  }
```

### Tab 4 — Orderflow
```
테이블: 페어 | OI | Funding | CVD상태 | 시장해석
[2-column grid] (각 페어 카드) {
  히트맵 텍스트
  CVD 상태 텍스트
}
Market Maker Context [3-column]:
  Short Squeeze 완료 | ETH 구조 약세 | 과열 경계
```

### Tab 5 — Scenarios
```
[vertical list]
  Card (각 페어) {
    [3-column] Scenario A | B | C {
      상단 색상 바
      시나리오명
      확률 진행 바 + %
      진입/SL/TP/R:R
    }
  }
```

### Tab 6 — Risk
```
트레이딩 플랜 (우선순위 1-4):
  [번호 원 | 내용(셋업,진입,SL,TP,RR) | 신뢰도 바 + 노트]
리스크 팩터 테이블:
  팩터명 | 설명 | High/Medium/Low
```

---

## 6. 현재 알려진 문제점

| 항목 | 내용 | 심각도 |
|------|------|--------|
| 모바일 미지원 | 2-3컬럼 그리드가 모바일에서 깨짐 | 높음 |
| 이중 헤더 | index.html nav + 대시보드 내부 헤더 중복 | 중간 |
| Babel 초기 로딩 | Babel Standalone CDN으로 브라우저 컴파일 → 첫 로드 3-5초 지연 | 중간 |
| 탭 콘텐츠 스크롤 | 내용이 길어 스크롤이 많음. 특히 EW/Risk 탭 | 낮음 |
| 텍스트 과밀 | Orderflow/Risk 탭의 설명 텍스트 가독성 부족 | 낮음 |

---

## 7. 반응형 설계 요구사항

### 브레이크포인트 (미결정 — 디자이너가 결정)
현재 없음. 아래는 권장 기준:
```
Mobile:  < 768px
Tablet:  768px – 1024px
Desktop: > 1024px
```

### 모바일 우선순위 결정이 필요한 항목
각 탭에서 모바일 화면에 어떤 정보를 우선 노출할지 결정 필요:

- **Overview**: 현재가 + bias + RSI만? OI/Funding 포함?
- **EW**: Primary Count만? Alternate/Invalidation 접기?
- **ICT**: BSL/SSL/OB/FVG 중 어떤 순서?
- **Scenarios**: 3시나리오 세로 스택 vs 스와이프?
- **Risk**: 플랜 상세 vs 요약 카드?

---

## 8. 외부 Nav (index.html) 구조

```
[fixed top bar, height: 49px]
  "Trading Analysis"  ◀  [날짜 드롭다운]  ▶     1/1    [새 탭으로 열기]
```

- 날짜 드롭다운: `reports/*_dashboard.html` 파일 기준으로 자동 생성
- iframe 높이: `calc(100vh - 49px)` (뷰포트 전체 차지)
- 모바일에서 nav가 너무 작아질 수 있음

---

## 9. 향후 기능 (설계 시 고려)

| 기능 | 상태 | 비고 |
|------|------|------|
| 텔레그램 알림 | 예정 | 특정 레벨 도달 시 알림. UI에서 알림 설정 화면 필요할 수 있음 |
| 추가 페어 | 가능성 있음 | 현재 4페어 고정 |
| 히스토리 차트 | 미결 | 날짜별 대시보드 간 비교 |

---

## 10. 파일 생성 흐름 (구현 참고)

```
매일 09:00 (로컬 macOS)
  └─ Playwright → TradingView/Coinglass/Coinalyze 차트 캡처
  └─ Claude CLI → 이미지 분석 → PAIRS 데이터 생성
  └─ React 컴포넌트에 데이터 주입 → YYYYMMDD_dashboard.html 생성
  └─ index.html 재생성 (대시보드 목록 업데이트)
  └─ git push → Vercel 자동 배포 (~30초)
```

디자이너가 생성하는 HTML 템플릿이 이 파이프라인으로 매일 새 데이터와 함께 자동 생성된다.  
즉, **컴포넌트 구조와 스타일은 고정되고 데이터만 교체되는 구조**.

---

## 11. 현재 대시보드 스크린샷 참고

현재 구현 상태:
- 상단: "Crypto Futures Analysis" 제목 + 날짜 + 분석 방법론 + 페어 목록
- 우측 상단: 시장 컨텍스트 뱃지 ("Short Squeeze Day", "1H 고점")
- 티커 바: BTC / ETH / SOL / HYPE 현재가 + 등락률
- 탭 바: Overview / Elliott Wave / ICT/SMC / Orderflow / Scenarios / Risk
- 탭 내용: 선택된 탭에 따라 동적 렌더링
