---
status: awaiting_human_verify
trigger: "Investigate and fix two regressions in reports/index.html introduced in commit c1a0ddb"
created: 2026-04-13T00:00:00Z
updated: 2026-04-13T00:00:00Z
---

## Current Focus
hypothesis: iframe height removed and button directions reversed in c1a0ddb — CONFIRMED
test: Fixed CSS and navigate() calls in reports/index.html
expecting: iframe fills viewport, buttons navigate in correct directions
next_action: Awaiting user verification in browser

## Symptoms
<!-- IMMUTABLE -->

expected:
1. iframe(#frame)이 네비게이션 바 아래 전체 뷰포트를 채워야 함 (100vw × calc(100vh-49px))
2. ◀ 버튼(btn-prev)은 이전(오래된) 날짜로 이동, ▶ 버튼(btn-next)은 다음(최신) 날짜로 이동

actual:
1. iframe이 다시 작아짐 — height 없이 `width: 100%`로 변경됨
2. 버튼 방향이 반전됨 — btn-prev가 최신으로 navigate(-1), btn-next가 과거로 navigate(1) 가리킴

errors: 없음 (기능 회귀)

timeline:
- 99b3913: "fix: swap arrow button directions" 에서 올바른 방향 확정
- b675dcc: "fix: use 100vw/calc height for iframe" 에서 올바른 height 확정
- c1a0ddb (현재 HEAD): 파이프라인이 index.html을 재생성하면서 양쪽 fix가 모두 되돌아감

reproduction: reports/index.html 을 브라우저에서 열면 즉시 재현

## Eliminated
<!-- APPEND only -->

## Evidence
<!-- APPEND only -->

- timestamp: 2026-04-13T00:00:00Z
  checked: reports/index.html lines 32-35 (iframe CSS), 41-43 (button elements), 62-67 (updateNav function)
  found: |
    1. iframe CSS missing height: width: 100%; (should be width: 100vw; height: calc(100vh - 49px);)
    2. btn-prev: navigate(-1) with disabled = current === 0 (reversed)
    3. btn-next: navigate(1) with disabled = current === dashboards.length-1 (reversed)
  implication: Confirmed root cause from c1a0ddb: both regressions present and fixable

- timestamp: 2026-04-13T00:00:01Z
  checked: Applied three targeted fixes
  found: |
    1. iframe CSS: changed to width: 100vw; height: calc(100vh - 49px);
    2. btn-prev onclick: changed navigate(-1) → navigate(1)
    3. btn-next onclick: changed navigate(1) → navigate(-1)
    4. updateNav: swapped disabled conditions to match correct navigate directions
  implication: All regressions reverted to confirmed-working state from commits 99b3913 and b675dcc

## Resolution

root_cause: c1a0ddb에서 reports/index.html 재생성 시 두 가지 변경 발생

1. iframe CSS: height calc 제거되고 width: 100%로 변경
2. button navigate() 방향 반전 및 disabled 로직 반전

fix: |
  1. iframe CSS (line 32-35): width: 100%; → width: 100vw; height: calc(100vh - 49px);
  2. btn-prev (line 41): navigate(-1) → navigate(1)
  3. btn-next (line 43): navigate(1) → navigate(-1)
  4. updateNav (line 64-65): disabled conditions swapped to match navigate directions

verification: Self-verified via git diff showing exact reverts to known-good commits 99b3913 and b675dcc

files_changed:
  - reports/index.html
