# ICT 대시보드 기능 테스트 결과

> 실행: 2026-05-15T06:43:42.375Z

## 요약

| 항목 | 값 |
|------|----|
| 전체 | 38 |
| 통과 | 38 ✅ |
| 실패 | 0  |
| 통과율 | 100.0% |

## 전체 결과

| # | 테스트 | 상태 | 소요 |
|---|--------|------|------|
| 1 | FVG [HTF 4H] — 모든 감지 FVG 가 3-캔들 갭 조건을 만족한다 | ✅ PASS | 1ms |
| 2 | FVG [LTF 15m] — 모든 감지 FVG 가 3-캔들 갭 조건을 만족한다 | ✅ PASS | 0ms |
| 3 | FVG — mitigated 상태인 FVG 는 이후 캔들 close 가 gap 내에 있다 | ✅ PASS | 0ms |
| 4 | OB [HTF 4H] — Bull OB 는 직전 캔들이 음봉이다 | ✅ PASS | 0ms |
| 5 | OB [HTF 4H] — Bear OB 는 직전 캔들이 양봉이다 | ✅ PASS | 0ms |
| 6 | OB [HTF 4H] — OB high/low 가 해당 캔들의 open/close 범위와 일치한다 | ✅ PASS | 0ms |
| 7 | OB [HTF 4H] — invalidated OB 는 이후 캔들 close 가 범위를 벗어난다 | ✅ PASS | 0ms |
| 8 | 시그널 — 필수 필드가 모두 존재한다 (direction, tier, entry, sl, tp, rr) | ✅ PASS | 0ms |
| 9 | 시그널 — entry 객체 구조가 올바르다 (entry.price) | ✅ PASS | 0ms |
| 10 | 시그널 [LONG] — SL < entry.price 이다 | ✅ PASS | 0ms |
| 11 | 시그널 [SHORT] — SL > entry.price 이다 | ✅ PASS | 0ms |
| 12 | 시그널 [LONG] — TP1 > entry.price 이다 | ✅ PASS | 0ms |
| 13 | 시그널 [SHORT] — TP1 < entry.price 이다 | ✅ PASS | 0ms |
| 14 | 시그널 — R:R 계산이 minRR 이상이다 | ✅ PASS | 0ms |
| 15 | 시그널 — TP 공식 검증 (risk * minRR 배수) | ✅ PASS | 0ms |
| 16 | 시그널 — levels.fvgs 가 배열이다 | ✅ PASS | 0ms |
| 17 | 시그널 — levels.obs 가 배열이다 | ✅ PASS | 0ms |
| 18 | 시그널 — scorecard 구조가 올바르다 | ✅ PASS | 0ms |
| 19 | 가격 표시 — BTC 현재가가 Binance REST 대비 ±0.5% 이내이다 | ✅ PASS | 69ms |
| 20 | 가격 변화율 — priceChange 엘리먼트가 up 또는 dn 클래스를 가진다 | ✅ PASS | 1ms |
| 21 | 킬존 배지 — UTC 6시: 킬존 대기 상태여야 한다 | ✅ PASS | 3ms |
| 22 | 오버레이 토글 — FVG 버튼 클릭 시 state.overlays.fvg 이 false 로 바뀐다 | ✅ PASS | 243ms |
| 23 | 오버레이 토글 — FVG 버튼 재클릭 시 state.overlays.fvg 이 true 로 복구된다 | ✅ PASS | 246ms |
| 24 | 오버레이 토글 — OB 버튼 클릭 시 state.overlays.ob 이 false 로 바뀐다 | ✅ PASS | 217ms |
| 25 | 오버레이 토글 — OB 버튼 재클릭 시 state.overlays.ob 이 true 로 복구된다 | ✅ PASS | 233ms |
| 26 | 오버레이 토글 — BB 버튼 클릭 시 state.overlays.bb 이 false 로 바뀐다 | ✅ PASS | 226ms |
| 27 | 오버레이 토글 — BB 버튼 재클릭 시 state.overlays.bb 이 true 로 복구된다 | ✅ PASS | 224ms |
| 28 | 오버레이 토글 — SWEEP 버튼 클릭 시 state.overlays.sweep 이 false 로 바뀐다 | ✅ PASS | 246ms |
| 29 | 오버레이 토글 — SWEEP 버튼 재클릭 시 state.overlays.sweep 이 true 로 복구된다 | ✅ PASS | 230ms |
| 30 | 오버레이 토글 — FVG off 상태에서 overlayData.fvgs 는 보존된다 | ✅ PASS | 362ms |
| 31 | 분석 실행 — 버튼 클릭 시 로딩 상태가 됐다가 완료된다 | ✅ PASS | 348ms |
| 32 | 분석 후 overlayData — fvgs 배열이 존재한다 | ✅ PASS | 4ms |
| 33 | 분석 후 overlayData — fvgs 각 항목이 high > low 를 만족한다 | ✅ PASS | 3ms |
| 34 | 분석 후 overlayData — obs 배열이 존재한다 | ✅ PASS | 8ms |
| 35 | 분석 후 overlayData — obs 각 항목이 high > low 를 만족한다 | ✅ PASS | 5ms |
| 36 | 분석 후 — 시그널 패널 또는 NEUTRAL 메시지가 표시된다 | ✅ PASS | 2ms |
| 37 | 분석 후 FVG overlay — FVG levels 가 시그널의 FVG 범위 내에 있다 | ✅ PASS | 15ms |
| 38 | 브라우저 콘솔 — 기능 테스트 중 JS 오류 없음 | ✅ PASS | 0ms |
