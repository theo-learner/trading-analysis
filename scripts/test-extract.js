/**
 * test-extract.js — 수정된 extractPriceData 함수 단일 테스트
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

async function extractPriceData(page, pair, tf) {
  // Legend 컨테이너가 실제로 DOM에 렌더링될 때까지 대기 (최대 10초)
  try {
    await page.waitForSelector('[class*="legend-l31H9iuA"]', { timeout: 10000 });
  } catch (err) {
    console.warn(`[${pair} ${tf}] Legend container not found after 10s: ${err.message}`);
  }

  return await page.evaluate(({ pair, tf }) => {
    // ① 현재가 추출
    let currentPrice = null;

    // 시도 1: Close 값에서 가격 추출
    const priceValues = Array.from(document.querySelectorAll('.valueValue-l31H9iuA')).map(el => el.innerText?.trim());
    if (priceValues.length >= 4) {
      currentPrice = priceValues[3]; // Close
    }

    // 시도 2: legend 컨테이너에서 가격 텍스트 파싱
    if (!currentPrice) {
      const mainLegend = document.querySelector('[class*="legend-l31H9iuA"]');
      if (mainLegend) {
        const lines = mainLegend.innerText?.split('\n').map(l => l.trim()) || [];
        const cIndex = lines.indexOf('C');
        if (cIndex !== -1 && cIndex < lines.length - 1) {
          currentPrice = lines[cIndex + 1];
        }
      }
    }

    // ② Legend 값 추출
    const legendContainers = Array.from(document.querySelectorAll('[class*="legend-l31H9iuA"]'));
    const legendValues = [];
    const legendTitles = [];

    for (let i = 1; i < legendContainers.length; i++) {
      const container = legendContainers[i];
      const text = container.innerText?.trim() || '';
      const lines = text.split('\n').map(l => l.trim());

      if (lines.length > 0) {
        legendTitles.push(lines[0]);

        for (let j = lines.length - 1; j >= 1; j--) {
          if (/^[\d.,\-+%]+$/.test(lines[j])) {
            legendValues.push(lines[j]);
            break;
          }
        }
      }
    }

    return {
      pair,
      tf,
      currentPrice: currentPrice || null,
      legendValues,
      legendTitles,
      timestamp: new Date().toISOString(),
      _debug: {
        priceFound: currentPrice !== null,
        legendCount: legendValues.length,
        titlesCount: legendTitles.length,
        containerCount: legendContainers.length,
      },
    };
  }, { pair, tf });
}

(async () => {
  log('🧪', 'extractPriceData 함수 테스트 시작...');

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
    const tf = '60'; // 1H

    const url = `https://www.tradingview.com/chart/?symbol=BINANCE:${pair}.P&interval=${tf}`;
    log('📂', `로딩: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    log('⏳', '차트 렌더링 대기...');
    await page.waitForSelector('.chart-container', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(5000);

    // fullscreen 모드 진입
    log('🖥️', 'Fullscreen 모드 진입...');
    await page.keyboard.press('Shift+F');
    await page.waitForTimeout(2000);

    // 현재 캔들을 좌측 70% 지점에 배치
    const { width, height } = VIEWPORT;
    await page.mouse.click(width / 2, height / 2);
    await page.waitForTimeout(300);

    // 포지셔닝
    await page.keyboard.press('End');
    await page.waitForTimeout(800);
    const dragDistance = Math.round(width * 0.30);
    const startX = Math.round(width * 0.60);
    const endX = startX - dragDistance;
    const midY = Math.round(height * 0.45);
    await page.mouse.move(startX, midY);
    await page.waitForTimeout(100);
    await page.mouse.down();
    await page.mouse.move(endX, midY, { steps: 15 });
    await page.waitForTimeout(100);
    await page.mouse.up();
    await page.waitForTimeout(500);

    // fullscreen 안정화 대기
    await page.waitForTimeout(1500);

    // 추출 실행
    log('📊', '가격 데이터 추출...');
    const data = await extractPriceData(page, pair, tf);

    log('📋', '추출 결과:');
    console.log(JSON.stringify(data, null, 2));

    if (data.currentPrice === null) {
      log('⚠️', 'currentPrice가 여전히 null!');
      log('🔍', 'DOM 재확인...');

      const debugInfo = await page.evaluate(() => {
        const legendContainers = Array.from(document.querySelectorAll('[class*="legend-l31H9iuA"]'));
        const priceValues = Array.from(document.querySelectorAll('.valueValue-l31H9iuA'));

        return {
          legendContainers: legendContainers.length,
          priceValues: priceValues.length,
          priceTexts: priceValues.map(el => el.innerText?.trim()),
          firstLegendText: legendContainers[0]?.innerText?.slice(0, 200),
        };
      });
      console.log('DEBUG:', JSON.stringify(debugInfo, null, 2));
    } else {
      log('✅', `추출 성공! 가격: ${data.currentPrice}, 지표: ${data.legendValues.length}개`);
    }
  } catch (err) {
    log('❌', `오류: ${err.message}`);
    console.error(err);
  } finally {
    await context.close();
    await browser.close();
  }
})();
