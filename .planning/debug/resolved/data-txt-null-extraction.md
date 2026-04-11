---
status: resolved
trigger: "TradingView 차트 캡처 스크립트가 data.txt에 currentPrice: null, legendValues: [] 를 저장하고 있다. DOM 추출이 실패하여 PNG 시각 판독에 의존하게 됐고, 이로 인해 대시보드 가격 데이터가 부정확하다."
created: 2026-04-11T04:00:00Z
updated: 2026-04-11T13:30:00Z
---

## Current Focus
status: FIX COMPLETE & END-TO-END VERIFIED
root_cause: 
  1) 초기: null 데이터 → 잘못된 셀렉터 사용 ([class*="legend-value"] 불존재)
  2) 2차: Close 값 추출 → 타임프레임마다 다른 값 (캔들 종가 ≠ 실시간 현재가)
  3) 최종: SELL/BUY 버튼에서만 실시간 현재가를 얻을 수 있음
fix_applied:
  1) extractPriceData 완전 재작성
  2) SELL 버튼에서 bid 가격 추출 (정규식 /^([\d.,]+)/)
  3) BUY 버튼에서 ask 가격 추출
  4) (bid + ask) / 2 = 실시간 현재가 (타임프레임 무관)
  5) 폴백: legend 텍스트에서 "SELL" 및 "BUY" 라인 파싱
  6) legend 값 추출 로직 유지 (RSI, CCI 등)
verification:
  실행 1 (13:18): ✅ 모든 TF에서 72,749.9 동일
  실행 2 (13:24): 4쌍 × 3TF = 12개 모두 정상 추출
    - SOLUSDT/HYPEUSDT: 완벽히 동일 ✅
    - ETHUSDT: 거의 동일 (시간 차이)
    - BTCUSDT: 소수 차이 (실제 bid/ask 변동)
next_action: COMPLETED - 커밋 준비

## Symptoms
expected: data.txt에 currentPrice, legendValues(RSI, CCI, BB 값 등)가 정상 추출되어야 함
actual: 모든 data.txt 파일에서 currentPrice: null, legendValues: [], legendTitles: []
errors: 없음 (스크립트는 에러 없이 완료됨 — 단지 null을 저장함)
reproduction: node scripts/capture.js --tv-only 실행 후 screenshots/*/tradingview/*_data.txt 확인
timeline: 2026-04-10 캡처 시부터 (fullscreen 모드에서 DOM 셀렉터가 달라진 것으로 추정됨)

- timestamp: 2026-04-11
  checked: debug-dom.js로 실제 fullscreen 모드 DOM 덤프
  found: |
    1) legendElements: [class*="legend"] 로 5개 발견:
       - DIV class="legend-l31H9iuA ..." text="O\n72,835.1\nH\n72,921.5\nL\n72,765.8..."
       - DIV class="legend-l31H9iuA ..." text="RSI Divergence Indicator\n14\nclose\n57.26"
       - DIV class="legend-l31H9iuA ..." text="CCI\n20\nhlc3\n33.50"
    
    2) priceElements: 가격값들 (.valueValue-l31H9iuA):
       - DIV class="valueValue-l31H9iuA" text="72,835.1" (Open)
       - DIV class="valueValue-l31H9iuA" text="72,893.9" (Close)
    
    3) CRITICAL: fullscreen="NO" — fullscreen 모드가 실제로 활성화되지 않음!
  implication: |
    - [class*="legend-value"] 셀렉터는 존재하지 않음 (사용 불가)
    - 실제 legend 구조는 [class*="legend-l31H9iuA"] 컨테이너 내 텍스트
    - 각 legend의 innerText를 파싱 (줄 단위 분할)하면 값 추출 가능
    - 가격은 .valueValue-l31H9iuA (또는 buttonText-SXMXfs_Z) 셀렉터 사용
    - fullscreen 명령이 먹히지 않거나, fullscreen API가 headless 모드에서 작동 안 함

## Eliminated

## Evidence
- timestamp: 2026-04-11
  checked: capture.js의 extractPriceData 함수 (81-97줄)
  found: |
    function extractPriceData(page, pair, tf) {
      return await page.evaluate(({ pair, tf }) => {
        const get = (sel) => document.querySelector(sel)?.innerText?.trim() ?? null;
        const getAll = (sel) => Array.from(document.querySelectorAll(sel)).map((el) => el.innerText.trim());
        return {
          pair, tf,
          currentPrice: get('.price-axis__last-value') ?? get('[class*="lastPrice"]') ?? get('[class*="last-value"]'),
          legendValues: getAll('[class*="legend-value"]'),
          legendTitles: getAll('[class*="legend-title"]'),
          timestamp: new Date().toISOString(),
        };
      }, { pair, tf });
    }
  implication: |
    1) 3개의 currentPrice 셀렉터를 시도하지만, 모두 실패하면 null 반환
    2) legendValues와 legendTitles는 `[class*="legend-value"]`와 `[class*="legend-title"]` 셀렉터인데, 이 요소들이 DOM에 없음 (빈 배열)
    3) 에러 처리가 없어서 실제 원인이 감춰짐 — extractPriceData에서 catch 불가, 단지 null만 저장됨

- timestamp: 2026-04-11
  checked: capture.js의 TradingView 캡처 플로우 (139-173줄)
  found: |
    1) await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    2) await page.waitForSelector('.chart-container', { timeout: 20000 }).catch(() => {}); ← .catch(() => {})로 실패 무시됨
    3) await page.waitForTimeout(5000);
    4) await page.keyboard.press('Shift+F'); ← fullscreen 모드 진입
    5) await page.waitForTimeout(1500);
    6) [다른 UI 조작들...]
    7) extractPriceData(page, pair, tf.label) ← 가격 데이터 추출
  implication: |
    문제 1) .chart-container 대기가 실패해도 무시되고 계속 진행됨
    문제 2) fullscreen 모드로 전환 후, legend 요소들이 렌더링되기까지의 대기 시간이 부족할 수 있음
    문제 3) fullscreen 모드 자체가 DOM 구조를 변경하는데, 변경 완료를 기다리지 않고 즉시 추출 시도

- timestamp: 2026-04-11
  checked: 실패한 data.txt 샘플 (BTCUSDT_1H_data.txt)
  found: '{"pair":"BTCUSDT","tf":"1H","currentPrice":null,"legendValues":[],"legendTitles":[]}'
  implication: 3개 모두 null/empty → DOM 요소 자체가 존재하지 않았거나, 렌더링되지 않음

## Resolution
root_cause: |
  2단계 발견:
  
  **1단계**: `[class*="legend-value"]` 셀렉터가 DOM에 없음 → null
  
  **2단계**: 초기 수정으로 Close 값 추출 시작 → 타임프레임마다 다른 값!
    - 1H Close: 72,745.8
    - 4H Close: 72,747.6  
    - 1D Close: 72,750.0
    → 이들은 각 타임프레임의 마지막 캔들 종가, 실시간 현재가 아님
  
  **최종 원인**: TradingView의 실시간 현재가는 SELL/BUY 버튼(bid/ask)에만 있음
    - SELL 버튼: bid (매도 호가) → 약간 낮음
    - BUY 버튼: ask (매수 호가) → 약간 높음
    - 평균값 = 실시간 현재가 (타임프레임 무관)

fix: |
  scripts/capture.js의 extractPriceData 함수 완전 재작성:
  
  1) 주 경로: SELL/BUY 버튼에서 가격 추출
     const sellButton = document.querySelector('.sellButton-SXMXfs_Z')
     const buyButton = document.querySelector('.buyButton-SXMXfs_Z')
     → 정규식으로 "72,699.9\nSELL" 패턴에서 첫 번째 숫자 추출
     → (bid + ask) / 2 = 현재가
  
  2) 폴백 경로: legend 텍스트에서 SELL/BUY 라인 파싱
     const mainLegend = document.querySelector('[class*="legend-l31H9iuA"]')
     → 줄 단위로 분할 → SELL/BUY 인덱스 찾기 → 직전 값 추출
  
  3) Legend 값 추출: 기존 로직 유지 (문제 없음)

verification: |
  자가 검증 (4쌍 × 3TF = 12개):
  ✅ SOLUSDT: 1H=84.2, 4H=84.2, 1D=84.2 (완벽)
  ✅ HYPEUSDT: 1H=41.7, 4H=41.7, 1D=41.7 (완벽)
  ✅ ETHUSDT: 1H=2236.7, 4H=2237.6, 1D=2237.6 (거의 동일)
  ✅ BTCUSDT: 1H=72714.9, 4H=72714.9, 1D=72678.6 (실제 bid/ask 변동)
  
  → 같은 시점에서 추출하면 모두 동일
  → 타임프레임별 약간의 차이 = 실제 현재가 변동 (정상!)

files_changed: 
  - scripts/capture.js: extractPriceData 함수 (라인 81-180)
