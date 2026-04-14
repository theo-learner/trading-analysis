---
status: awaiting_human_verify
trigger: "iframe-dashboard-cutoff: Vercel 배포 URL의 index.html iframe 안에서 대시보드가 잘림. 직접 새 탭으로 열면 정상"
created: 2026-04-12T02:00:00Z
updated: 2026-04-12T02:17:00Z
---

## Current Focus
hypothesis: CONFIRMED — Dashboard 최상위 div에 overflow:auto 추가됨
test: git commit 5146251 완료. 파일 검증: 두 대시보드 모두 overflow:auto 추가 확인
expecting: Vercel 자동 배포 후 iframe 안에서 모든 탭 콘텐츠가 스크롤 가능하게 표시
next_action: 사용자가 https://trading-analysis-livid.vercel.app 재방문하여 iframe 콘텐츠 스크롤 확인

## Symptoms
expected: index.html의 iframe 안에서도 대시보드 모든 탭(Overview / Elliott Wave / ICT/SMC / Orderflow / Scenarios / Risk)과 전체 콘텐츠가 스크롤 가능하게 표시
actual: iframe 안에서는 카드 일부만 보이고 나머지 콘텐츠가 잘림. 스크롤 불가. 직접 새 탭에서 열면 정상 표시
errors: 브라우저 콘솔 에러 없음
reproduction: https://trading-analysis-livid.vercel.app 접속 후 iframe 확인 / "새 탭으로 열기" 클릭 후 비교
started: 2026-04-12

## Eliminated
- 가설: renderTab() IIFE 구조 (이전 session)
  evidence: commit 45ee4a9에서 이미 해결됨. 현재 20260412/20260411_dashboard.html 모두 직접 switch 문 사용 중
  timestamp: 2026-04-11T00:00:00Z

- 가설: React 렌더링 자체 실패
  evidence: 탭 클릭 시 상단 nav 헤더는 정상 렌더링됨. 탭도 클릭 가능 (상태 변경됨). 문제는 콘텐츠 영역의 오버플로우 처리
  timestamp: 2026-04-12T02:13:00Z

## Evidence
- timestamp: 2026-04-12T02:10:00Z
  checked: index.html iframe 구조 분석
  found: iframe#frame { position: fixed; top: 49px; bottom: 0; } — 정확한 높이 제약. 부모 body { overflow: hidden }
  implication: iframe 콘텐츠는 parent container의 정확한 높이로 제약됨

- timestamp: 2026-04-12T02:12:00Z
  checked: 20260412_dashboard.html Dashboard 컨테이너 (line 532)
  found: <div style={{ minHeight: '100vh', background: C.bg, paddingBottom: 40 }}> — overflow 설정 없음
  implication: 콘텐츠가 100vh를 넘으면 html/body가 확장되어야 하는데, iframe 높이 제약에 의해 내용이 잘림 (overflow:hidden처럼 작동)

- timestamp: 2026-04-12T02:13:00Z
  checked: 20260411_dashboard.html Dashboard 컨테이너 (line 776)
  found: <div style={{ background: colors.bg, minHeight: "100vh", fontFamily: ... }}> — overflow 설정 없음
  implication: 동일한 문제. 두 파일 모두 수정 필요

- timestamp: 2026-04-12T02:14:00Z
  checked: 직접 열 때 vs iframe 안에서의 차이
  found: 직접 열면 브라우저 기본 스크롤 가능 (body 자체가 scrollable). iframe 안에서는 parent의 overflow:hidden 때문에 자식 내용의 overflow:auto가 frame 높이 내에서 작동해야 함
  implication: Dashboard 최상위 div에 overflow:auto 추가 필요

## Resolution
root_cause: Dashboard 컴포넌트 최상위 div (line 532 in 20260412, line 776 in 20260411)가 minHeight:100vh 설정은 있지만 overflow:auto 속성이 없음. 
iframe 부모(index.html)는 body { overflow: hidden }으로 스크롤 불가하게 설정되어 있으므로, 콘텐츠가 iframe 높이를 넘으면 iframe 하단에 잘림.
직접 새 탭으로 열면 브라우저 전체 윈도우가 viewport이므로 body 자동 스크롤로 정상 표시됨.

fix: Dashboard 최상위 div에 overflow: 'auto' 추가. 이렇게 하면 iframe 내에서도 콘텐츠가 frame 높이 내에서 스크롤 가능하게 됨.

변경 사항:
- reports/20260412_dashboard.html line 532: minHeight → minHeight + overflow:auto
- reports/20260411_dashboard.html line 776: minHeight → minHeight + overflow:auto

verification: Vercel 재배포 후 iframe 안에서 탭 콘텐츠 전체가 스크롤 가능하게 표시되는지 확인
files_changed:
  - reports/20260412_dashboard.html: overflow:auto 추가
  - reports/20260411_dashboard.html: overflow:auto 추가
