# Codex Review — 2026-04-18T13:09:59Z

## Summary
전체적으로는 의도한 TypeUI Clean 라이트 전환이 잘 반영됐고, 탭 계약·데이터 계약·모바일 레이아웃도 유지됐습니다. 데스크톱/모바일 Chromium 렌더 기준으로 탭 전환과 레이아웃은 정상입니다. 다만 라이트 테마 핵심 품질인 대비와 토큰 일관성에서 아직 마무리가 덜 됐습니다. 특히 `Badge` 계열과 분석 탭 내부 상태 패널들이 옅게 보이고, `AnalysisCard` 헤더 구분선은 사실상 사라졌습니다.

## Issues

### HIGH
- 발견 없음.

### MEDIUM
- `Badge`의 현재 대비가 라이트 배경에서 부족합니다. [reports/20260418_dashboard.html](/Users/theo/workspace_tokamak/trading-analysis/reports/20260418_dashboard.html:396), [reports/20260418_dashboard.html](/Users/theo/workspace_tokamak/trading-analysis/reports/20260418_dashboard.html:1270)  
  `background: color + '18'`와 `color` 조합은 10–11px 텍스트 기준으로 꽤 옅습니다. 실제 계산해보면 bull 약 `2.96:1`, neutral 약 `2.88:1`, bear 약 `4.19:1` 수준이라 작은 텍스트 AA 기준 `4.5:1`에 못 미칩니다. 헤더 배지와 상태 칩이 실제 화면에서도 흐려 보입니다.

- 라이트 테마 마이그레이션이 아직 완전히 끝나지 않았습니다. 분석/전략 서브패널 여러 곳이 여전히 예전 시맨틱 색(`#4ade80`, `#f87171`, `#fbbf24` 등)을 하드코딩하고 있습니다. [reports/20260418_dashboard.html](/Users/theo/workspace_tokamak/trading-analysis/reports/20260418_dashboard.html:583), [reports/20260418_dashboard.html](/Users/theo/workspace_tokamak/trading-analysis/reports/20260418_dashboard.html:825), [reports/20260418_dashboard.html](/Users/theo/workspace_tokamak/trading-analysis/reports/20260418_dashboard.html:933), [reports/20260418_dashboard.html](/Users/theo/workspace_tokamak/trading-analysis/reports/20260418_dashboard.html:967), [reports/20260418_dashboard.html](/Users/theo/workspace_tokamak/trading-analysis/reports/20260418_dashboard.html:1006)  
  토큰은 라이트용으로 교체됐는데 내부 패널은 옛 팔레트를 계속 써서, 화면상 일부 영역만 다른 시스템처럼 보입니다. 사용자 관점에선 “통일된 리디자인”이 덜 된 상태입니다.

- `AnalysisCard` 헤더 구분선이 사실상 보이지 않습니다. [reports/20260418_dashboard.html](/Users/theo/workspace_tokamak/trading-analysis/reports/20260418_dashboard.html:976)  
  `borderBottom: 1px solid ${C.card}`에서 `C.card`가 이제 흰색이라, 가장 중요한 카드의 헤더와 본문이 평면적으로 붙어 보입니다. 이건 사용자가 지적한 대로 `C.border`가 맞습니다.

### LOW
- 탭 언더라인 구현은 현재 Chromium 데스크톱/모바일 렌더에선 정상입니다. 다만 `marginBottom: '-1px'` 의존은 약간 취약한 패턴입니다. [reports/20260418_dashboard.html](/Users/theo/workspace_tokamak/trading-analysis/reports/20260418_dashboard.html:1296)  
  브라우저별 줌이나 device-pixel-ratio 조합에서 1px seam이 드물게 보일 수는 있습니다. 지금 당장 버그로 보진 않지만, 더 견고한 방법은 있습니다.

- `SectionTitle`의 `C.dim` + `10px` 조합은 라이트 배경에서 꽤 옅습니다. [reports/20260418_dashboard.html](/Users/theo/workspace_tokamak/trading-analysis/reports/20260418_dashboard.html:425)  
  스타일 의도는 맞지만, 저해상도 디스플레이에선 시선 유도가 약할 수 있습니다.

## Suggestions
- `AnalysisCard` 구분선은 바로 바꾸는 게 맞습니다.
```js
borderBottom: `1px solid ${C.border}`
```

- 시맨틱 색 사용을 한 군데로 모으는 편이 좋습니다. 지금처럼 곳곳에 `#4ade80`류가 남으면 다음 테마 변경 때 또 새어 나옵니다.
```js
function semanticTone(kind, alpha = '12') {
  const color = kind === 'bull' ? C.bull : kind === 'bear' ? C.bear : C.neutral;
  return {
    color,
    background: color + alpha,
    border: color + '35',
  };
}
```
이걸 `strategyTone`, `tfDirStyle`, `biasStyle`, confluence chip, ICTGrid 서브카드에 공통 적용하세요.

- `Badge`는 별도 텍스트 톤을 두는 쪽이 낫습니다. 현재 `C.bull`/`C.neutral`은 작은 텍스트용으론 충분히 어둡지 않습니다.
```js
const C = {
  // ...
  bullText: '#166534',
  bearText: '#991b1b',
  neutralText: '#92400e',
};

function badgeTone(kind) {
  const color = kind === 'bull' ? C.bullText : kind === 'bear' ? C.bearText : C.neutralText;
  return {
    color,
    background: color + '10',
    border: '1px solid ' + color + '24',
  };
}
```

- 탭 언더라인을 더 견고하게 가려면 negative margin 대신 inset shadow로 바꿀 수 있습니다.
```js
border: 'none',
marginBottom: 0,
boxShadow: activeTab === tab
  ? `inset 0 -2px 0 ${C.primary}`
  : 'inset 0 -2px 0 transparent',
```

## Overall Risk
**MEDIUM** — 데이터나 탭 동작은 안전하지만, 라이트 테마에서 가장 중요한 대비와 토큰 일관성 문제가 핵심 UI 전반에 남아 있어 시각 품질 회귀가 분명합니다.
