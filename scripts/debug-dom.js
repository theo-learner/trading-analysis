/**
 * debug-dom.js — TradingView fullscreen 모드에서 실제 DOM 구조를 덤프
 * 목표: legend/price 요소의 정확한 셀렉터와 클래스 파악
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
  log('🔍', 'TradingView DOM 분석 시작...');

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
    await page.waitForTimeout(3000);

    // DOM 전체 덤프
    const dump = await page.evaluate(() => {
      const dump = {
        timestamp: new Date().toISOString(),
        fullscreen: document.fullscreenElement ? 'YES' : 'NO',
        viewport: `${window.innerWidth}x${window.innerHeight}`,

        // 모든 가격 관련 요소
        priceElements: Array.from(document.querySelectorAll('[class*="price"], [class*="last"]'))
          .slice(0, 20) // 최대 20개
          .map(el => ({
            tag: el.tagName,
            class: el.className,
            id: el.id,
            text: el.innerText?.slice(0, 100) || '',
          })),

        // 모든 legend 관련 요소
        legendElements: Array.from(document.querySelectorAll('[class*="legend"]'))
          .map(el => ({
            tag: el.tagName,
            class: el.className,
            id: el.id,
            text: el.innerText?.slice(0, 100) || '',
          })),

        // 모든 value/title 포함 요소
        valueElements: Array.from(document.querySelectorAll('[class*="value"], [class*="title"]'))
          .slice(0, 30)
          .map(el => ({
            tag: el.tagName,
            class: el.className,
            text: el.innerText?.slice(0, 100) || '',
          })),

        // 숫자 텍스트 포함 요소 샘플
        numberElements: Array.from(document.querySelectorAll('*'))
          .filter(el => /^\d+[\d.,]*$/.test(el.innerText?.trim() || ''))
          .slice(0, 20)
          .map(el => ({
            tag: el.tagName,
            class: el.className,
            text: el.innerText?.slice(0, 100) || '',
          })),
      };

      return dump;
    });

    // 결과 저장
    const outputPath = path.join(__dirname, '..', '.planning', 'debug', 'dom-dump.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(dump, null, 2));

    log('💾', `DOM 덤프 저장: ${outputPath}`);
    log('🔍', `Legend 요소: ${dump.legendElements.length}개`);
    log('🔍', `가격 요소: ${dump.priceElements.length}개`);
    log('🔍', `값/제목 요소: ${dump.valueElements.length}개`);
    log('🔍', `숫자 포함 요소: ${dump.numberElements.length}개`);

    if (dump.legendElements.length === 0) {
      log('⚠️', 'Legend 요소를 찾을 수 없음!');
      log('⚠️', '다른 셀렉터 시도 중...');

      // 추가 시도: 더 광범위한 검색
      const extraDump = await page.evaluate(() => {
        return {
          allDivs: Array.from(document.querySelectorAll('div[class*="legend"], div[class*="indicator"]'))
            .slice(0, 15)
            .map(el => ({
              class: el.className,
              text: el.innerText?.slice(0, 100) || '[empty]',
            })),
          svgElements: Array.from(document.querySelectorAll('svg')).length,
          canvasElements: Array.from(document.querySelectorAll('canvas')).length,
        };
      });

      fs.writeFileSync(
        path.join(__dirname, '..', '.planning', 'debug', 'dom-dump-extra.json'),
        JSON.stringify(extraDump, null, 2)
      );
      log('💾', '추가 덤프 저장: dom-dump-extra.json');
    }
  } catch (err) {
    log('❌', `오류: ${err.message}`);
  } finally {
    await context.close();
    await browser.close();
    log('🏁', '종료');
  }
})();
