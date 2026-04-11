/**
 * verify-price-fix.js — 수정된 currentPrice 추출 검증
 *
 * 목표: 같은 쌍의 서로 다른 타임프레임에서 currentPrice가 동일한 값을 반환하는지 확인
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
  try {
    await page.waitForSelector('[class*="legend-l31H9iuA"]', { timeout: 10000 });
  } catch (err) {
    console.warn(`[${pair} ${tf}] Legend container not found: ${err.message}`);
  }

  return await page.evaluate(({ pair, tf }) => {
    let currentPrice = null;

    // SELL/BUY 버튼에서 실시간 가격 읽기
    const sellButton = document.querySelector('.sellButton-SXMXfs_Z');
    const buyButton = document.querySelector('.buyButton-SXMXfs_Z');

    if (sellButton && buyButton) {
      const sellText = sellButton.innerText?.trim() || '';
      const buyText = buyButton.innerText?.trim() || '';

      const sellMatch = sellText.match(/^([\d.,]+)/);
      const buyMatch = buyText.match(/^([\d.,]+)/);

      if (sellMatch && buyMatch) {
        const sellPrice = parseFloat(sellMatch[1].replace(/,/g, ''));
        const buyPrice = parseFloat(buyMatch[1].replace(/,/g, ''));
        const avgPrice = (sellPrice + buyPrice) / 2;
        currentPrice = avgPrice.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }
    }

    // 폴백
    if (!currentPrice) {
      const mainLegend = document.querySelector('[class*="legend-l31H9iuA"]');
      if (mainLegend) {
        const text = mainLegend.innerText?.trim() || '';
        const lines = text.split('\n').map(l => l.trim());
        const sellIdx = lines.indexOf('SELL');
        const buyIdx = lines.indexOf('BUY');

        if (sellIdx !== -1 && sellIdx > 0) {
          const sellPrice = parseFloat(lines[sellIdx - 1].replace(/,/g, ''));
          if (buyIdx !== -1 && buyIdx > 0) {
            const buyPrice = parseFloat(lines[buyIdx - 1].replace(/,/g, ''));
            const avgPrice = (sellPrice + buyPrice) / 2;
            currentPrice = avgPrice.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
          }
        }
      }
    }

    // Legend 값 추출
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
      currentPrice,
      legendValues,
      legendTitles,
      timestamp: new Date().toISOString(),
    };
  }, { pair, tf });
}

(async () => {
  log('🧪', '현재가 추출 검증 시작...');

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

      const data = await extractPriceData(page, pair, tf.label);
      results.push(data);

      log('✅', `${tf.label}: currentPrice = ${data.currentPrice}`);
      log('✅', `${tf.label}: indicators = ${data.legendTitles.join(', ')}`);
    }

    // 검증: 모든 타임프레임의 currentPrice가 동일한가?
    log('\n📊 === 검증 결과 ===');
    const prices = results.map(r => r.currentPrice);
    const allSame = prices.every(p => p === prices[0]);

    if (allSame) {
      log('✅', `모든 타임프레임의 currentPrice가 동일: ${prices[0]}`);
    } else {
      log('❌', `타임프레임별 currentPrice가 다름:`);
      results.forEach(r => {
        log('❌', `  ${r.tf}: ${r.currentPrice}`);
      });
    }

    // 결과 저장
    const outputPath = path.join(__dirname, '..', '.planning', 'debug', 'verify-price-fix.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ success: allSame, results }, null, 2));

    log('💾', `검증 결과 저장: ${outputPath}`);

  } catch (err) {
    log('❌', `오류: ${err.message}`);
    console.error(err);
  } finally {
    await context.close();
    await browser.close();
    log('🏁', '종료');
  }
})();
