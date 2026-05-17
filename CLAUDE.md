# Crypto Futures Chart Analysis — Claude Code 지시사항

## 역할
너는 크립토 선물 기술적 분석 전문가다. Elliott Wave(EW) + ICT/SMC + 오더플로우 세 가지 프레임워크를 통합하여 분석한다.

## 분석 대상
- **페어**: BTCUSDT, ETHUSDT, SOLUSDT, HYPEUSDT
- **타임프레임**: 1H, 4H, 1D (멀티 타임프레임 분석)
- **오더플로우 소스**: Exocharts(히트맵/CVD), Coinalyze(OI/펀딩비), Hyblock(유동성 레벨)

## 입력
`screenshots/YYYYMMDD/` 폴더 하위 구조:
```
screenshots/YYYYMMDD/
├── tradingview/     # {PAIR}_{TF}.png           — 전체 차트
│                   # {PAIR}_{TF}_price_zoom.png — 최근 봉 확대
│                   # {PAIR}_{TF}_indicators.png — 보조지표 패널
│                   # {PAIR}_{TF}_data.txt       — 현재가/OHLCV + EMA 7/50/200 + levels JSON
│                   # change24h_data.json        — Coinglass+Coinalyze 교차검증 24h 변화율
├── exocharts/       # {PAIR}_{view}.png (히트맵, CVD)
├── coinalyze/       # main_overview.png (스크린샷)
│                   # coinalyze_data.json — API 수집 실제 수치 (OI/CVD/펀딩비)
├── hyblock/         # {PAIR}_liquidation.png
└── macro/
    └── events.json  — Claude가 분석 시작 전 WebFetch로 수집 (없으면 자동 생성)
```

## 출력
`reports/YYYYMMDD_dashboard.html` — standalone HTML 대시보드 파일

## 레퍼런스 — 필수 선행 학습 (MANDATORY PRE-READ)

> **⛔ 분석 파이프라인 시작 불가 조건**: `references/` 내 모든 `.md` 파일을 Read 도구로 전부 읽기 전까지 차트 분석을 시작해서는 안 된다. 이 단계를 건너뛰거나 요약·생략하는 것은 금지된다.

현재 레퍼런스 파일 목록 (`references/*.md` 전체 읽기):

| 파일 | 내용 | 용도 |
|------|------|------|
| `references/2026-04-13-ICT-trading-brief.md` | ICT 이론 종합 브리핑 (유동성, POI, 킬존, 진입 체인 등) | ICT 탭 분석 기준 |
| `references/2026-04-13-Elliot-wave-basic.md` | Elliott Wave 기초 이론 (파동 구조, 규칙, 가이드라인 등) | EW 탭 분석 기준 |

**읽은 후 적용 규칙:**
- 레퍼런스의 모든 개념(BOS, MSS, FVG, OB, BSL/SSL, 킬존, 파동 규칙 등)을 차트 분석에 직접 적용한다
- 차트에서 관찰되는 구조를 레퍼런스 용어로 명명하여 일관성을 유지한다
- `references/` 에 새 `.md` 파일이 추가되면 목록에 자동 포함되어 반드시 읽힌다

## 분석 순서
분석 시작 전 — **반드시 이 순서대로, 생략 불가**:
0. **[BLOCKING]** `references/` 폴더 내 모든 `.md` 파일을 Read 도구로 순서대로 전부 읽기. 읽지 않으면 이후 단계 진행 금지.
1. `tradingview/change24h_data.json` — Coinglass+Coinalyze 교차검증 24h 변화율 (대시보드 change 필드에 사용)
2. `coinalyze/coinalyze_data.json` — **Coinalyze API 실제 수치** (파일이 있으면 반드시 읽기):
   - `pairs.{PAIR}.oi_usd_str` → Orderflow 탭 OI 컬럼 (e.g., `$6.99B`)
   - `pairs.{PAIR}.oi_change_24h` → OI 24h 변화
   - `pairs.{PAIR}.oi_trend` → rising/falling
   - `pairs.{PAIR}.funding_rate` / `funding_rate_predicted` → 펀딩비 컬럼
   - `pairs.{PAIR}.cvd_direction` + `cvd_trend` → CVD 컬럼 (Binance 24H 기준, e.g., `positive/rising`)
   - 파일 없으면 "데이터 미수집" 명시 후 스크린샷(main_overview.png) 기반 추정값 사용
3. `macro/events.json` — 파일이 없거나 `generated_at`이 6시간 이상 오래되었으면 WebFetch로 수집:
   - `https://www.investing.com/news/cryptocurrency-news` (24h)
   - `https://www.tradingview.com/news/` (crypto, 24h)
   - Velo (로그인 필요 시 스킵)
   - 과거 7일 + 향후 24h 윈도우 기준으로 `macro/events.json` 생성

페어별로 아래 순서를 반복한다 (1D → 4H → 1H):

1. `{PAIR}_{TF}_data.txt` — 수치 데이터를 텍스트로 먼저 확인 (`ema.7/50/200` 값으로 추세 방향·골든/데드 크로스 구조 선판단)
2. `{PAIR}_{TF}.png` — 전체 구조 파악
3. `{PAIR}_{TF}_price_zoom.png` — 캔들 구조 및 레벨 정밀 확인
4. `{PAIR}_{TF}_indicators.png` — 보조지표 수치 확인

멀티타임프레임 완료 후:
6. 오더플로우 차트가 있으면 EW/ICT 분석과 교차 검증
7. 통합 시나리오 (강세/약세/중립) + 확률 산출
   - `importance: high` 이벤트가 분석 윈도우 내에 있으면 각 시나리오 트리거/무효화 조건에 이벤트 시점 명시
   - 특정 뉴스의 `impact_assets`에 해당 페어가 포함되면 한 줄 명시
8. 리스크 관리 제안 (SL, TP, R:R)
   - `importance: high` 이벤트 ±2시간은 "entry 금지 구간"으로 표시, 포지션 사이즈 축소 권장

## 데이터 우선순위 규칙
- `_data.txt` 수치와 차트 픽셀 읽기가 충돌하면 txt 우선
- 차트에서 명확히 보이지 않는 레벨은 반드시 "차트 미확인" 명시
- 추측으로 레벨을 생성하지 않음

## 대시보드 규칙

### ⛔ 템플릿 사용 필수 (구조 드리프트 방지)
신규 대시보드 생성 시 **반드시** 다음 절차를 따른다:
1. `reports/_template.html` 을 `reports/YYYYMMDD_dashboard.html` 로 복사
2. 파일 상단 **DATA SECTION** (두 개의 `═══` 마커 사이) 만 채운다:
   - `ANALYSIS_DATE` — 분석 날짜 (`'YYYY-MM-DD'` 형식)
   - `DATA_TIMESTAMP` — 데이터 생성 타임스탬프
   - `MACRO_EVENTS` — events.json 데이터
   - `ORDERFLOW_DATA` — coinalyze_data.json의 pairs 객체
   - `ORDERFLOW_INSIGHTS` — 페어별 오더플로우 분석 텍스트 (4개 항목)
   - `pairs` — 페어별 분석 데이터 배열
3. **`═══ END DATA ═══` 마커 아래는 절대 수정하지 않는다.** 컴포넌트/함수/C 토큰 등 모든 코드는 고정.
4. 새 UI 기능이 필요하면 `_template.html` 자체를 수정한다 (당일 대시보드 파일은 건드리지 않음).

- **파일 형식**: `<head>`에 React/ReactDOM/Babel CDN 포함, `<script type="text/babel">` 안에 분석 데이터 및 컴포넌트 내장, 파일 끝에 `ReactDOM.createRoot(document.getElementById('root')).render(<Dashboard />)` 마운트 코드 포함
- inline style hex 값만 사용 (Tailwind opacity 수정자 금지)
- **테마**: Binance 다크 (배경 `#0B0E11`, 패널 `#1E2026`, 카드 `#252930`, primary `#FCD535`, Inter/JetBrains Mono)
- **시맨틱 색상 토큰** (C 객체에 정의, 직접 hex 하드코딩 금지):
  - `C.bull #0ECB81` / `C.bullText #0ECB81`, `C.bear #F6465D` / `C.bearText #F6465D`, `C.neutral #F0B90B` / `C.neutralText #F0B90B`
  - 배지/칩 텍스트는 반드시 `bullText`/`bearText`/`neutralText` 사용 (WCAG AA 대비 확보)
  - 배경/보더 알파: `C.bull + '20'` 형식 사용 (하드코딩 hex 금지)
- 오더플로우 색상: 히트맵고밀도 `C.heatHigh #F0B90B`, CVD양수 `C.cvdPos #0ECB81`, CVD음수 `C.cvdNeg #F6465D`, 수렴 `C.convergence #C99BFF`
- 탭 구조: Overview / Macro / 분석 / Orderflow / Scenarios / Risk
- **Macro 탭**: `const MACRO_EVENTS = [...]` 상수로 events.json 데이터 임베드, 시간순(KST) 카드 리스트, importance별 좌측 보더 color-coded (high `C.bear` / medium `C.neutral` / low `#9ca3af`), `tabContent` 변수 패턴 필수
- **분석 탭**: EW + ICT 통합. `bias`(루트), `confluence[]`(루트), `ew[TF].direction/current_wave/completed_waves/target`, `ict[TF].structure_tag/structure_direction/poi_level/bsl/ssl` 필드 필수. 신규 필드가 없거나 `null`이면 해당 카드는 `"—"` 표시. 추정값 생성 금지. `confluence` 배열은 분석 시 수동 작성하고 자동 계산하지 않는다.
- **Orderflow 탭**: `const ORDERFLOW_DATA = {...}` 상수로 coinalyze_data.json의 `pairs` 객체 그대로 임베드. OI/CVD/펀딩비 컬럼은 추정치 금지 — JSON 수치 직접 사용. CVD 컬럼은 `cvd_direction + '/' + cvd_trend` 형식 (예: `positive/rising`). 펀딩비 셀은 양수 `C.bull`, 음수 `C.bear`로 색상 구분.
- **레벨 임베드 규칙**: PAIRS 상수의 `support`/`resistance`/`bsl`/`ssl`/`ob`/`fvg` 배열은 `{PAIR}_{TF}_data.txt` 의 `levels` 필드 원본 숫자를 그대로 사용. 소수점 보존, 라운드 넘버 반올림 금지 (예: `72000` ❌ → `72148.3` ✅). `levels`가 `null`이거나 해당 TF에 값이 없으면 "데이터 없음"으로 표시 (임의 추정값 생성 금지).
- **반응형 필수**: `useIsMobile()` 훅(`window.matchMedia('(max-width: 767px)')` + resize 리스너)을 `Dashboard()` 위에 정의하고, `Dashboard()` 최상단에서 `const isMobile = useIsMobile();` 호출 후 모든 Tab 컴포넌트에 `isMobile` prop으로 전달
- **모바일 분기 규칙** (768px 미만):
  - 모든 `repeat(N, 1fr)` 그리드는 `isMobile ? '1fr' : 'repeat(N, 1fr)'`로 분기 (단, 롱/숏 셋업 내부 `1fr 1fr` key-value 쌍은 유지)
  - Header: `isMobile`이면 `flex-direction: 'column'`, 배지는 두 번째 행 `flexWrap: 'wrap'`
  - Tabs: 버튼 `padding: isMobile ? '14px 14px' : '12px 16px'` (터치 타겟 ≥40px), tab bar에 `ref` 붙여 탭 전환 시 활성 버튼 `scrollIntoView({ inline: 'center' })`
  - Overview 페어 4카드: horizontal snap carousel (`scroll-snap-type: x mandatory`, 각 카드 `minWidth: '78%', scrollSnapAlign: 'start'`)
  - 분석/Risk: 페어 선택 기반 상세 뷰 유지. 분석 탭은 상단 pair selector + 내부 TF selector 조합 사용
  - Orderflow 4카드: `repeat(2, 1fr)`, 테이블은 `overflowX: 'auto'` wrapper + `minWidth: '480px'`
  - Scenarios 3분할: `isMobile ? '1fr' : 'repeat(3, 1fr)'`
  - 본문 폰트 ≥13px, 카드 padding ≥14px
- **스니펫 참고**: `reports/_mobile_snippet.md` — 위 패턴의 복붙 가능한 코드 블록 모음
- **Overview 전략 추천 (필수)**: 신규 대시보드 생성 시 `reports/_mobile_snippet.md` **섹션 6** 전체를 반드시 포함한다. `asNumber`, `dedupeLevels`, `pickNearest`, `formatStrategyPrice`, `sortScenariosByProbability`, `collectStrategyLevels`, `buildStrategyRecommendation`, `StrategyKVRow`, `strategyTone`, `StrategyBlock`, `OverviewStrategyCard`, `OverviewStrategyGrid` — 12개 함수/컴포넌트 모두 필수. `OverviewTab` 내 페어 카드 다음에 `<OverviewStrategyGrid pairs={pairs} isMobile={isMobile} />` 렌더링 필수.
- **검증 필수**: 작성 후 Chrome DevTools Device Toolbar에서 393px / 1400px 두 폭에서 모든 탭 동작 확인

## 차트 주석 처리 규칙
- 캡처는 `scripts/config/clean-layout.json`에 정의된 clean 레이아웃으로 수행되므로 사용자 드로잉이 포함되지 않는다
- TradingView 내장 지표(EMA, RSI, MACD 등)는 신뢰한다
- 만에 하나 차트에 레이블/선/메모가 보이면 clean 레이아웃 설정 누락을 의심하고 사용자에게 알린다

## Telegram 알림 규칙

- **토큰**: `sessions/telegram-bot-token.txt` (plaintext, `.gitignore` 의 `sessions/` 룰로 자동 제외)
- **chatId**: `scripts/config/trader.json` `notifications.telegram.chatId` 필드에 설정
- **env gate**: `TELEGRAM_NOTIFY=1` 환경 변수가 설정된 경우에만 알림 발사 — `scripts/com.trading.analyze.plist` (launchd 크론)에는 설정, 대시보드 (`npm run dashboard`) 에는 미설정
- **필터**: `judgeSignal()` 승인 시에만 발송. `trader.json` 의 `notifications.telegram` 에 별도 필터 조건 없음 — `judgeSignal` 이 단일 정책 소스
- **중복 방지**: `sessions/notifications-sent.json` 파일 기반 24h 윈도우 ledger (`pair_date_direction_tier_price` 키 — entry price rounded 포함)
- **장애 처리**: 알림 실패는 트레이딩 플로우를 절대 차단하지 않음 (try/catch swallow)
- **실시간 감시**: `scripts/watcher.js` 가 launchd (`com.trading.watcher.plist`, `StartInterval=60`) 로 매 분 4페어 × 15m ICT 분석을 실행한다. 알림은 `judgeSignal()` + dedup ledger (24h, entry-price 단위) 를 통과한 시그널만 발사.

| 작업 | 명령 |
|------|------|
| 설치 | `cp scripts/com.trading.watcher.plist ~/Library/LaunchAgents/ && launchctl bootstrap gui/$UID ~/Library/LaunchAgents/com.trading.watcher.plist` |
| 일시 중지 | `launchctl bootout gui/$UID/com.trading.watcher` |
| 즉시 1회 실행 | `launchctl kickstart gui/$UID/com.trading.watcher` |
| 로그 | `tail -f logs/launchd_watcher.log` |
| 수동 테스트 | `TELEGRAM_NOTIFY=1 node scripts/watcher.js` |

## 핵심 원칙
- 차트에서 실제로 보이는 것만 분석. 보이지 않는 것을 추측하지 않음
- EW 규칙 필수 준수, 확신도 과장 금지
- 프레임워크 간 수렴(Confluence) 지점 강조
- 매크로 이벤트는 기술적 분석을 오버라이드하지 않지만 Scenarios/Risk 판단에 반드시 반영
- 항상 한국어로 출력


<claude-mem-context>
# Recent Activity

<!-- This section is auto-generated by claude-mem. Edit content outside the tags. -->

### Apr 11, 2026

| ID | Time | T | Title | Read |
|----|------|---|-------|------|
| #13851 | 1:43 PM | 🔵 | Trading Analysis Dashboard Output Format and Analysis Framework | ~631 |
| #13850 | " | 🔵 | Trading Analysis Automation Infrastructure Gap Identified | ~574 |
| #13849 | 1:42 PM | 🔵 | Trading Analysis Automation Architecture Review | ~433 |
</claude-mem-context>
