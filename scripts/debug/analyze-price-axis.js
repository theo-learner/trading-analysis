/**
 * analyze-price-axis.js — TradingView 가격 축(price axis) 레이블 정확히 찾기
 *
 * TradingView에서 Y축 우측의 실시간 현재가 레이블은:
 * - 타임프레임 변경 후에도 동일한 값
 * - 차트의 가장 우측 상단 가격축에 위치
 * - 현재 가격(bid/ask)을 표시
 *
 * 목표: 어느 요소가 이 값을 가지고 있는지 정확히 파악
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_DIR = path.join(__dirname, '..', 'sessions');
const VIEWPORT = { width: 1920, height: 1080 };
const DEVICE_SCALE = 2;

function sessionExists(filename) {
  const p = path.join(SESSION_DIR, filename);
  return fs.existsSync(p) ? p : null;
}

function log(emoji, msg) {
  const ts = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  console.log(`[${ts}] ${emoji} ${msg}`);
}

(async () => {
  log('🔍', '가격 축 레이블 분석 시작...');

  const sessionPath = sessionExists('tv-session.json');
  const contextOpts = {
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
  };
  if (sessionPath) {
    contextOpts.storageState = sessionPath;
    log('🔑', 'TradingView 세션 로드');
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--window-size=1920,1080', '--no-sandbox'],
  });

  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  try {
    const pair = 'BTCUSDT';
    const timeframes = ['60', '240', '1D'];
    const results = {};

    for (const tf of timeframes) {
      const url = `https://www.tradingview.com/chart/?symbol=BINANCE:${pair}.P&interval=${tf}`;
      log('📂', `로딩: ${pair} ${tf}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      log('⏳', '차트 렌더링 대기...');
      await page.waitForSelector('.chart-container', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(5000);

      // fullscreen 모드 진입
      log('🖥️', `Fullscreen 모드 진입... (${tf})`);
      await page.keyboard.press('Shift+F');
      await page.waitForTimeout(3000);

      // 가격 축 분석
      const analysis = await page.evaluate(() => {
        const result = {
          timeframe: 'unknown',
          timestamp: new Date().toISOString(),

          // 1) 모든 가능한 가격 요소 탐색
          possiblePriceLabels: [],

          // 2) 가격 축(price axis) 관련 요소
          priceAxisElements: [],

          // 3) 범위: 100,000 ~ 10,000 범위의 숫자들 (비트코인 가격대)
          priceRangeNumbers: [],

          // 4) 실제 가격일 것 같은 후보
          priceAxisCandidates: [],
        };

        // ─── 모든 DIV 순회 ───
        const allDivs = Array.from(document.querySelectorAll('div'));

        for (const div of allDivs) {
          const text = div.innerText?.trim() || '';
          const className = div.className || '';

          // 10,000 ~ 100,000 범위 숫자 찾기 (비트코인 현재가 범위)
          const match = text.match(/^(\d{1,3}(?:,\d{3})*(?:\.\d+)?)/);
          if (match) {
            const numStr = match[1].replace(/,/g, '');
            const num = parseFloat(numStr);

            if (num >= 30000 && num <= 100000) {
              // 자식이 적거나 없는 단순 요소 (가능성 높음)
              const childrenCount = div.children.length;
              if (childrenCount <= 2) {
                result.priceRangeNumbers.push({
                  value: text.substring(0, 30),
                  class: className.substring(0, 80),
                  childrenCount,
                  position: {
                    x: div.getBoundingClientRect().x,
                    y: div.getBoundingClientRect().y,
                  },
                });
              }
            }
          }
        }

        // ─── Y축 우측 영역 (x > 1800) 필터링 ───
        result.priceAxisCandidates = result.priceRangeNumbers
          .filter(p => p.position.x > 1700)
          .sort((a, b) => a.position.y - b.position.y)
          .slice(0, 10);

        // ─── legend-l31H9iuA 분석 ───
        const legendContainers = Array.from(document.querySelectorAll('[class*="legend-l31H9iuA"]'));
        result.legendAnalysis = {
          count: legendContainers.length,
          items: legendContainers.map((container, idx) => {
            const text = container.innerText?.trim() || '';
            const lines = text.split('\n').map(l => l.trim());
            return {
              index: idx,
              text: text.substring(0, 100),
              lines: lines.slice(0, 8),
            };
          }),
        };

        return result;
      }, { tf });

      results[tf] = analysis;
      log('✅', `분석 완료: ${tf}`);
    }

    // 결과 저장 및 비교
    const outputPath = path.join(__dirname, '..', '.planning', 'debug', 'price-axis-analysis.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    log('💾', `분석 결과 저장: ${outputPath}`);

    // 타임프레임별 가격 비교
    log('📊', '=== 타임프레임별 가격 비교 ===');
    for (const [tf, analysis] of Object.entries(results)) {
      if (analysis.priceAxisCandidates.length > 0) {
        const top = analysis.priceAxisCandidates[0];
        log('📍', `${tf}: 상위 후보 = "${top.value}" (위치: x=${top.position.x.toFixed(0)}, y=${top.position.y.toFixed(0)})`);
      }
    }

  } catch (err) {
    log('❌', `오류: ${err.message}`);
    console.error(err);
  } finally {
    await context.close();
    await browser.close();
    log('🏁', '종료');
  }
})();
