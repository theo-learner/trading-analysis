/**
 * debug-1d-only.js — BTCUSDT 1D에서만 가격이 다른 문제 분석
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
  log('🔍', 'BTCUSDT 1D 분석 시작...');

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
    const tf = '1D';
    const url = `https://www.tradingview.com/chart/?symbol=BINANCE:${pair}.P&interval=${tf}`;

    log('📂', `로딩: ${pair} ${tf}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

    log('⏳', '차트 렌더링 대기...');
    await page.waitForSelector('.chart-container', { timeout: 20000 }).catch(() => {});
    await page.waitForTimeout(5000);

    log('🖥️', 'Fullscreen 모드 진입...');
    await page.keyboard.press('Shift+F');
    await page.waitForTimeout(2000);

    log('🔍', 'Legend 정보 전체 덤프...');
    const dump = await page.evaluate(() => {
      const result = {
        sellButtonFound: false,
        buyButtonFound: false,
        sellButtonText: null,
        buyButtonText: null,

        mainLegendText: null,
        mainLegendLines: null,

        allLegendContainers: [],
      };

      // SELL/BUY 버튼 확인
      const sellBtn = document.querySelector('.sellButton-SXMXfs_Z');
      const buyBtn = document.querySelector('.buyButton-SXMXfs_Z');

      result.sellButtonFound = !!sellBtn;
      result.buyButtonFound = !!buyBtn;
      if (sellBtn) result.sellButtonText = sellBtn.innerText?.trim() || '';
      if (buyBtn) result.buyButtonText = buyBtn.innerText?.trim() || '';

      // Main legend 정보
      const mainLegend = document.querySelector('[class*="legend-l31H9iuA"]');
      if (mainLegend) {
        result.mainLegendText = mainLegend.innerText?.trim() || '';
        result.mainLegendLines = result.mainLegendText.split('\n').map(l => l.trim()).slice(0, 15);
      }

      // 모든 legend 컨테이너
      const legendContainers = Array.from(document.querySelectorAll('[class*="legend-l31H9iuA"]'));
      result.allLegendContainers = legendContainers.map((container, idx) => ({
        index: idx,
        class: container.className.substring(0, 100),
        text: container.innerText?.trim().substring(0, 150) || '[empty]',
      }));

      return result;
    });

    log('📊', `SELL 버튼 found: ${dump.sellButtonFound}`);
    if (dump.sellButtonText) log('📊', `  Text: "${dump.sellButtonText}"`);

    log('📊', `BUY 버튼 found: ${dump.buyButtonFound}`);
    if (dump.buyButtonText) log('📊', `  Text: "${dump.buyButtonText}"`);

    log('📊', `Main legend first 15 lines:`);
    if (dump.mainLegendLines) {
      dump.mainLegendLines.forEach((line, idx) => {
        log('📊', `  [${idx}] "${line}"`);
      });
    }

    log('📊', `Total legend containers: ${dump.allLegendContainers.length}`);

    // 결과 저장
    const outputPath = path.join(__dirname, '..', '.planning', 'debug', 'debug-1d-only.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2));

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
