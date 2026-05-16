# ICT 대시보드 Playwright 테스트 결과

> 실행: 2026-05-15T14:59:20.787Z

## 요약

| 항목 | 값 |
|------|----|
| 전체 | 43 |
| 통과 | 39 ✅ |
| 실패 | 4 ❌ |
| 통과율 | 90.7% |

## 이슈 목록

### 1. 헤더 — 4개 TF 필 존재 (15M/1H/4H/1D)

```
필 수: 2
```

### 2. TF 필 — 1H 기본 활성화

```
active tf: 15m
```

### 3. TF 필 — 1D 클릭 시 활성화

```
locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('.tf-pill[data-tf="1d"]')[22m

```

### 4. TF 필 — 1H 복귀

```
locator.click: Timeout 30000ms exceeded.
Call log:
[2m  - waiting for locator('.tf-pill[data-tf="1h"]')[22m

```

## 전체 결과

| # | 테스트 | 상태 | 소요 |
|---|--------|------|------|
| 1 | GET /api/config — 200, 객체 반환 | ✅ PASS | 7ms |
| 2 | GET /api/trades — 200, 배열 반환 | ✅ PASS | 2ms |
| 3 | GET /api/signals — 200, 배열 반환 | ✅ PASS | 14ms |
| 4 | GET /api/analyze-log — 200, {running, log} 구조 | ✅ PASS | 2ms |
| 5 | GET /api/latest-signal?pair=BTCUSDT — 200 | ✅ PASS | 1ms |
| 6 | POST /api/trades — dry-run 거래 저장 | ✅ PASS | 3ms |
| 7 | POST /api/trades — 시그널 누락 시 400 | ✅ PASS | 1ms |
| 8 | POST /api/analyze 중복 실행 방지 (409 or 200) | ✅ PASS | 3ms |
| 9 | GET /api/events — SSE 연결 수립 | ✅ PASS | 9ms |
| 10 | CORS preflight (OPTIONS) — 204 | ✅ PASS | 1ms |
| 11 | 존재하지 않는 경로 — 404 | ✅ PASS | 1ms |
| 12 | 페이지 로드 — HTTP 200, 타이틀 포함 | ✅ PASS | 156ms |
| 13 | 헤더 — 로고 "ICT Engine" 존재 | ✅ PASS | 15ms |
| 14 | 헤더 — 4개 페어 탭 존재 (BTC/ETH/SOL/HYPE) | ✅ PASS | 4ms |
| 15 | 헤더 — 4개 TF 필 존재 (15M/1H/4H/1D) | ❌ FAIL | 1ms |
| 16 | 헤더 — 킬존 배지 & DRY-RUN 배지 존재 | ✅ PASS | 6ms |
| 17 | 헤더 — 상태 닷(status dot) 존재 | ✅ PASS | 1ms |
| 18 | 페어 탭 — BTC 기본 활성화 | ✅ PASS | 2ms |
| 19 | 페어 탭 — ETH 클릭 시 활성화 | ✅ PASS | 369ms |
| 20 | 페어 탭 — SOL 클릭 시 활성화 | ✅ PASS | 325ms |
| 21 | 페어 탭 — HYPE 클릭 시 활성화 | ✅ PASS | 330ms |
| 22 | 페어 탭 — BTC 복귀 | ✅ PASS | 322ms |
| 23 | TF 필 — 1H 기본 활성화 | ❌ FAIL | 1ms |
| 24 | TF 필 — 4H 클릭 시 활성화 | ✅ PASS | 330ms |
| 25 | TF 필 — 1D 클릭 시 활성화 | ❌ FAIL | 30003ms |
| 26 | TF 필 — 15M 클릭 시 활성화 | ✅ PASS | 321ms |
| 27 | TF 필 — 1H 복귀 | ❌ FAIL | 30001ms |
| 28 | 오버레이 — FVG/OB/BB/Sweep 버튼 초기 활성(on) 상태 | ✅ PASS | 21ms |
| 29 | 오버레이 — FVG 버튼 토글 (on → off → on) | ✅ PASS | 450ms |
| 30 | 오버레이 — OB 버튼 토글 | ✅ PASS | 350ms |
| 31 | 차트 — #chart 컨테이너 존재 | ✅ PASS | 7ms |
| 32 | 차트 — 캔들 데이터 로드 후 canvas 렌더링 | ✅ PASS | 3003ms |
| 33 | 차트 — 가격 표시 업데이트 (—가 아닌 값) | ✅ PASS | 4004ms |
| 34 | ICT 분석 버튼 — 존재하고 클릭 가능 | ✅ PASS | 5ms |
| 35 | ICT 분석 버튼 — 클릭 시 로딩 스피너 표시 | ✅ PASS | 341ms |
| 36 | 로그 패널 — 분석 실행 후 표시 | ✅ PASS | 12ms |
| 37 | 스코어카드 — 섹션 타이틀 존재 | ✅ PASS | 6ms |
| 38 | AMD 사이클 — 4개 스테이지 존재 | ✅ PASS | 2ms |
| 39 | AMD 사이클 — 스테이지 텍스트 확인 (축적/조작/분배/리셋) | ✅ PASS | 1ms |
| 40 | 시그널 섹션 — 초기 플레이스홀더 또는 분석 후 시그널 카드 | ✅ PASS | 3ms |
| 41 | 트레이딩 이력 — 헤더 존재 | ✅ PASS | 2ms |
| 42 | 트레이딩 이력 — POST 후 거래 건수 증가 | ✅ PASS | 1509ms |
| 43 | 콘솔 오류 없음 (JavaScript 런타임 오류) | ✅ PASS | 0ms |
