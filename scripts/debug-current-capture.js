/**
 * debug-current-capture.js — 현재 capture.js 실행 시 실제 DOM 상태 확인
 *
 * 목표: extractPriceData가 어느 경로를 통해 currentPrice를 추출하는지 파악
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

async function debugExtractPriceData(page, pair, tf) {
  try {
    await page.waitForSelector('[class*="legend-l31H9iuA"]', { timeout: 10000 });
  } catch (err) {
    console.warn(`[${pair} ${tf}] Legend container not found`);
  }

  return await page.evaluate(({ pair, tf }) => {
    const debug = {
      pair,
      tf,
      sellButtonFound: false,
      buyButtonFound: false,
      sellButtonText: null,
      buyButtonText: null,
      sellMatch: null,
      buyMatch: null,
      usedFallback: false,
      legendSellIdx: null,
      legendBuyIdx: null,
      fallbackSellText: null,
      fallbackBuyText: null,
      finalPrice: null,
    };

    // 경로 1: SELL/BUY 버튼
    const sellButton = document.querySelector('.sellButton-SXMXfs_Z');
    const buyButton = document.querySelector('.buyButton-SXMXfs_Z');

    if (sellButton && buyButton) {
      debug.sellButtonFound = true;
      debug.buyButtonFound = true;
      debug.sellButtonText = sellButton.innerText?.trim() || '';
      debug.buyButtonText = buyButton.innerText?.trim() || '';

      const sellMatch = debug.sellButtonText.match(/^([\d.,]+)/);
      const buyMatch = debug.buyButtonText.match(/^([\d.,]+)/);

      if (sellMatch && buyMatch) {
        debug.sellMatch = sellMatch[1];
        debug.buyMatch = buyMatch[1];

        const sellPrice = parseFloat(sellMatch[1].replace(/,/g, ''));
        const buyPrice = parseFloat(buyMatch[1].replace(/,/g, ''));
        const avgPrice = (sellPrice + buyPrice) / 2;
        debug.finalPrice = avgPrice.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return debug;
      }
    }

    // 경로 2: 폴백 (legend 컨테이너)
    debug.usedFallback = true;
    const mainLegend = document.querySelector('[class*="legend-l31H9iuA"]');
    if (mainLegend) {
      const text = mainLegend.innerText?.trim() || '';
      const lines = text.split('\n').map(l => l.trim());
      const sellIdx = lines.indexOf('SELL');
      const buyIdx = lines.indexOf('BUY');

      debug.legendSellIdx = sellIdx;
      debug.legendBuyIdx = buyIdx;

      if (sellIdx !== -1 && sellIdx > 0) {
        debug.fallbackSellText = lines[sellIdx - 1];
        const sellPrice = parseFloat(lines[sellIdx - 1].replace(/,/g, ''));
        if (buyIdx !== -1 && buyIdx > 0) {
          debug.fallbackBuyText = lines[buyIdx - 1];
          const buyPrice = parseFloat(lines[buyIdx - 1].replace(/,/g, ''));
          const avgPrice = (sellPrice + buyPrice) / 2;
          debug.finalPrice = avgPrice.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        }
      }
    }

    return debug;
  }, { pair, tf });
}

(async () => {
  log('🔍', '현재 capture 동작 분석 시작...');

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
    const timeframes = [
      { label: '1H', value: '60' },
      { label: '4H', value: '240' },
      { label: '1D', value: '1D' },
    ];

    const results = [];

    for (const tf of timeframes) {
      const url = `https://www.tradingview.com/chart/?symbol=BINANCE:${pair}.P&interval=${tf.value}`;
      log('📂', `로딩: ${pair} ${tf.label}`);
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      log('⏳', '차트 렌더링 대기...');
      await page.waitForSelector('.chart-container', { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(5000);

      log('🖥️', `Fullscreen 모드 진입... (${tf.label})`);
      await page.keyboard.press('Shift+F');
      await page.waitForTimeout(3000);

      const debug = await debugExtractPriceData(page, pair, tf.label);
      results.push(debug);

      log('📊', `${tf.label}: 추출 결과`);
      log('📊', `  - 버튼 경로: ${debug.sellButtonFound && debug.buyButtonFound ? 'USED' : 'NOT FOUND'}`);
      if (debug.sellButtonFound && debug.buyButtonFound) {
        log('📊', `    SELL: ${debug.sellMatch}, BUY: ${debug.buyMatch}`);
      }
      if (debug.usedFallback) {
        log('📊', `  - 폴백 경로: USED`);
        log('📊', `    SELL idx: ${debug.legendSellIdx}, BUY idx: ${debug.legendBuyIdx}`);
        if (debug.fallbackSellText) {
          log('📊', `    SELL: ${debug.fallbackSellText}, BUY: ${debug.fallbackBuyText}`);
        }
      }
      log('📊', `  - 최종 가격: ${debug.finalPrice}`);
    }

    // 결과 저장
    const outputPath = path.join(__dirname, '..', '.planning', 'debug', 'debug-current-capture.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));

    log('💾', `분석 결과 저장: ${outputPath}`);

  } catch (err) {
    log('❌', `오류: ${err.message}`);
    console.error(err);
  } finally {
    await context.close();
    await browser.close();
    log('🏁', '종료');
  }
})();
