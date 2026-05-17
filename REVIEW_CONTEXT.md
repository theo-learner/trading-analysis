## Task Background

`reports/20260418_dashboard.html`의 기존 다크 테마를 TypeUI Clean 라이트 테마로 리디자인.
기존 탭 계약(`Overview / Macro / 분석 / Orderflow / Scenarios / Risk`), 데이터 계약(`PAIRS`, `MACRO_EVENTS`, `ORDERFLOW_DATA`), 모바일 레이아웃을 모두 유지하면서 시각적 시스템을 교체.

배경:
- 기존 대시보드는 다크 배경(`#0b0e14`) + IBM Plex 폰트 + 다크 그라디언트 카드 조합이었음
- TypeUI 디자인 시스템 중 "Clean" 테마(화이트 서피스, Poppins+Roboto+Inconsolata, 파란 primary)를 선택
- `CLAUDE.md`의 "다크 테마 필수" 규칙도 삭제해 앞으로 생성되는 대시보드가 이 변경을 따르도록 함

## Design Decisions

**1. 토큰 오브젝트 전면 교체**
`const C` 블록의 17개 토큰을 라이트 팔레트로 교체. `shell` 토큰 제거 후 `surface`/`panel`/`primaryBg`/`primaryBorder` 추가.
대안: 토큰을 점진적으로 바꾸는 방식도 가능했으나, 한 번에 교체하는 것이 잔여 다크 값 혼입 리스크가 낮음.

**2. 탭바 — 언더라인 전용 액티브 스테이트**
이전: 둥근 필(pill) fill + borderStrong 테두리.
변경: `borderBottom: '2px solid C.primary'`, `marginBottom: '-1px'` 패턴으로 언더라인만 사용.
Poppins 폰트, 액티브 시 `C.primary` 텍스트 색상 적용.
근거: TypeUI Clean의 탭 패턴과 일치, 라이트 서피스에서 필 스타일이 "버튼 모음"처럼 보이는 문제 회피.

**3. 다크 전용 인라인 데코레이션 3곳 수동 제거**
토큰 교체만으로는 처리 안 되는 하드코딩 패턴이 3곳 존재:
- Macro 이벤트 카드: `linear-gradient(C.card→C.cardAlt)` + `inset 0 1px 0 rgba(255,255,255,0.03)`
- AnalysisCard 패널: 동일 패턴
- Scenarios 카드: 동일 패턴
모두 플랫 `C.card` 배경 + 단순 `1px border`로 교체. Scenarios는 `borderTop: 3px solid color`로 방향성 표시 강화.

**4. 공유 프리미티브 업데이트**
- `Badge`: IBM Plex → Inconsolata, fontWeight 700 → 600
- `Card`: 그라디언트+inset shadow → 플랫 흰 배경, radius 12px → 10px
- `TFPill`: `C.panel` 비활성 bg → `C.surface`, boxShadow 제거
- `PairSelector`: `C.panel` → `C.surface`, Poppins 폰트 추가

**5. 시맨틱 색상 유지 (bull/bear/neutral)**
라이트 배경에서도 읽히도록 채도 높은 값으로 조정:
- bull: `#4ade80` → `#16a34a` (진한 초록)
- bear: `#f87171` → `#dc2626` (진한 빨강)
- neutral: `#fbbf24` → `#d97706` (진한 주황)

## Changed Files

- `docs/lessons.md`
- `docs/todo.md`
- `reports/20260418_dashboard.html`

## Review Focus

1. **라이트 테마에서 가독성** — bull `#16a34a` / bear `#dc2626` / neutral `#d97706`이 흰 배경 카드에서 충분히 구분되는지. 특히 배지(badge)의 `color+'18'` 반투명 배경이 너무 연하지 않은지.

2. **탭바 언더라인 패턴** — `marginBottom: '-1px'`으로 탭바 하단 border와 정렬하는 방식이 모든 브라우저에서 안정적으로 동작하는지.

3. **AnalysisCard borderBottom 색** — 라인 976: `borderBottom: \`1px solid ${C.card}\`` — 이제 `C.card`가 흰색이라 사실상 보이지 않는 구분선이 됨. `C.border`로 바꾸는 게 더 나을 수 있음.

4. **다크 전용 패턴 누락 가능성** — grep으로 주요 패턴(`rgba(255,255,255,0.0`, IBM Plex, `#0b0e14`)은 제거 확인했으나, 직접 컴포넌트 내부에 하드코딩된 어두운 색상 hex가 남아있을 가능성.
