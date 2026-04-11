/**
 * capture.js — TradingView 멀티TF + 오더플로우 플랫폼 자동 캡처
 *
 * 사용법: node scripts/capture.js [--tv-only] [--orderflow-only]
 *
 * 캡처 대상:
 *   TradingView : BTCUSDT, ETHUSDT, SOLUSDT, HYPEUSDT × 1H, 4H, 1D
 *   Coinglass   : BTC, ETH, SOL, HYPE 청산 히트맵
 *   Coinalyze   : 전체 OI + 펀딩비 메인 페이지
 *   Hyblock     : BTC, ETH 유동성 레벨
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// ─── 설정 ────────────────────────────────────────────────

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'HYPEUSDT'];
// futureShift: 현재 캔들을 중앙에 배치하기 위한 우측 여백 (Right 키 입력 횟수)
const TIMEFRAMES = [
  { label: '1H', value: '60'  },
  { label: '4H', value: '240' },
  { label: '1D', value: '1D'  },
];

const COINGLASS_TARGETS = [
  { pair: 'BTC',  path: 'LiquidationHeatMap',       coin: null   },
  { pair: 'ETH',  path: 'LiquidationHeatMap',       coin: 'ETH'  },
  { pair: 'SOL',  path: 'LiquidationHeatMapModel3', coin: 'SOL'  },
  { pair: 'HYPE', path: 'LiquidationHeatMap',       coin: 'HYPE' },
];

const COINALYZE_TARGETS = [
  { pair: 'BTCUSDT', slug: 'btcusdtperp-binance' },
  { pair: 'ETHUSDT', slug: 'ethusdtperp-binance' },
  { pair: 'SOLUSDT', slug: 'solusdtperp-binance' },
  { pair: 'HYPEUSDT', slug: 'hypeusdtperp-binance' },
];

const HYBLOCK_TARGETS = [
  { pair: 'BTC', slug: 'btc' },
  { pair: 'ETH', slug: 'eth' },
];

const SESSION_DIR = path.join(__dirname, '..', 'sessions');
const VIEWPORT = { width: 1920, height: 1080 };
const DEVICE_SCALE = 2; // Retina 품질

// ─── 유틸리티 ────────────────────────────────────────────

function getDateDir() {
  const now = new Date();
  return now.toISOString().slice(0, 10).replace(/-/g, '');
}

function getSavePath(category, name) {
  const dateDir = getDateDir();
  const dir = path.join(__dirname, '..', 'screenshots', dateDir, category);
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${name}.png`);
}

function sessionExists(filename) {
  const p = path.join(SESSION_DIR, filename);
  return fs.existsSync(p) ? p : null;
}

function getSaveDir(category) {
  const dateDir = getDateDir();
  const dir = path.join(__dirname, '..', 'screenshots', dateDir, category);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function log(emoji, msg) {
  const ts = new Date().toLocaleTimeString('ko-KR', { hour12: false });
  console.log(`[${ts}] ${emoji} ${msg}`);
}

async function extractPriceData(page, pair, tf) {
  // Legend 컨테이너가 실제로 DOM에 렌더링될 때까지 대기 (최대 10초)
  // [class*="legend-value"] 셀렉터가 존재하지 않으므로, 실제 legend-l31H9iuA 대기
  try {
    await page.waitForSelector('[class*="legend-l31H9iuA"]', { timeout: 10000 });
  } catch (err) {
    console.warn(`[${pair} ${tf}] Legend container not found after 10s: ${err.message}`);
  }

  return await page.evaluate(({ pair, tf }) => {
    // ① 현재가 추출 (실시간 bid/ask 가격)
    // TradingView의 실시간 현재가는 SELL 버튼과 BUY 버튼에 표시됨
    // (타임프레임과 무관하게 동일한 값)
    let currentPrice = null;

    // 전략: SELL 버튼과 BUY 버튼의 가격을 읽어서 평균 (실시간 현재가)
    const sellButton = document.querySelector('.sellButton-SXMXfs_Z');
    const buyButton = document.querySelector('.buyButton-SXMXfs_Z');

    if (sellButton && buyButton) {
      const sellText = sellButton.innerText?.trim() || '';
      const buyText = buyButton.innerText?.trim() || '';

      // 각 버튼 내 숫자 추출 (예: "72,749.7\nSELL" → "72,749.7")
      const sellMatch = sellText.match(/^([\d.,]+)/);
      const buyMatch = buyText.match(/^([\d.,]+)/);

      if (sellMatch && buyMatch) {
        const sellPrice = parseFloat(sellMatch[1].replace(/,/g, ''));
        const buyPrice = parseFloat(buyMatch[1].replace(/,/g, ''));
        const avgPrice = (sellPrice + buyPrice) / 2;
        currentPrice = avgPrice.toFixed(1).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      }
    }

    // 폴백: legend 컨테이너에서 SELL/BUY 정보 파싱
    if (!currentPrice) {
      const mainLegend = document.querySelector('[class*="legend-l31H9iuA"]');
      if (mainLegend) {
        const text = mainLegend.innerText?.trim() || '';
        // "C\n72,750.0\n−167.4 (−0.23%)\n72,749.9\nSELL\n0.1\n72,750.0\nBUY" 형식
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

    // ② Legend 값 추출
    // 각 legend 컨테이너에서 모든 값 수집 ([class*="legend-l31H9iuA"])
    const legendContainers = Array.from(document.querySelectorAll('[class*="legend-l31H9iuA"]'));

    // 첫 번째는 OHLC (가격), 이후는 지표값
    const legendValues = [];
    const legendTitles = [];

    for (let i = 1; i < legendContainers.length; i++) {
      // i=0은 OHLC 컨테이너, 나머지는 지표
      const container = legendContainers[i];
      const text = container.innerText?.trim() || '';
      const lines = text.split('\n').map(l => l.trim());

      if (lines.length > 0) {
        // 첫 줄: 지표명 (예: "RSI Divergence Indicator", "CCI")
        legendTitles.push(lines[0]);

        // 마지막 줄 (또는 숫자가 있는 줄): 값
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

async function positionChart(page, width, height) {
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
}

// ─── TradingView 캡처 ───────────────────────────────────

async function captureTradingView(browser) {
  log('📊', 'TradingView 캡처 시작...');

  const sessionPath = sessionExists('tv-session.json');
  const contextOpts = {
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
  };
  if (sessionPath) {
    contextOpts.storageState = sessionPath;
    log('🔑', 'TradingView 세션 로드 완료');
  } else {
    log('⚠️', 'TV 세션 없음 — 무료 차트로 진행 (일부 기능 제한)');
  }

  const context = await browser.newContext(contextOpts);
  const page = await context.newPage();

  for (const pair of PAIRS) {
    for (const tf of TIMEFRAMES) {
      const url = `https://www.tradingview.com/chart/?symbol=BINANCE:${pair}.P&interval=${tf.value}`;

      try {
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

        // 차트 렌더링 대기 (WebSocket 실시간 데이터 로딩 포함)
        await page.waitForSelector('.chart-container', { timeout: 20000 }).catch(() => {});
        await page.waitForTimeout(5000);

        // 풀스크린 모드 진입 및 DOM 재렌더링 대기
        await page.keyboard.press('Shift+F');
        await page.waitForTimeout(2000); // fullscreen DOM 재구성 대기

        // 팝업/오버레이 닫기 시도
        await page.keyboard.press('Escape');
        await page.waitForTimeout(500);

        // 현재 캔들을 좌측 70% 지점에 배치 (End → 마우스 드래그로 30% 미래 공간 확보)
        const { width, height } = VIEWPORT;
        await page.mouse.click(width / 2, height / 2);
        await page.waitForTimeout(300);
        await positionChart(page, width, height);

        // fullscreen 모드 안정화 대기 — legend 렌더링 완료까지
        await page.waitForTimeout(1500);

        // ① 전체 차트 (full)
        const savePath = getSavePath('tradingview', `${pair}_${tf.label}`);
        await page.screenshot({ fullPage: false, path: savePath, type: 'png' });
        log('✅', `${pair} ${tf.label} 전체 캡처 완료`);

        // ② price_data.txt — DOM에서 현재가 + OHLCV legend 추출
        try {
          const priceData = await extractPriceData(page, pair, tf.label);
          const txtPath = path.join(getSaveDir('tradingview'), `${pair}_${tf.label}_data.txt`);

          // 디버깅 정보 제거 (프로덕션 저장은 JSON만)
          const { _debug, ...cleanData } = priceData;
          fs.writeFileSync(txtPath, JSON.stringify(cleanData, null, 2));

          // 디버깅 로그: currentPrice가 null이면 경고
          if (priceData.currentPrice === null || priceData.legendValues.length === 0) {
            log('⚠️', `${pair} ${tf.label} 가격 데이터 불완전 (price: ${priceData.currentPrice}, legends: ${priceData.legendValues.length})`);
          } else {
            log('📝', `${pair} ${tf.label} 가격 데이터 저장 완료 (가격: ${priceData.currentPrice}, 지표: ${priceData.legendValues.length})`);
          }
        } catch (dataErr) {
          log('⚠️', `${pair} ${tf.label} 가격 데이터 추출 실패: ${dataErr.message}`);
        }

        // ③ price_zoom — 최근 봉 확대 후 캡처
        try {
          const cx = Math.round(width * 0.5);
          const cy = Math.round(height * 0.45);
          await page.mouse.move(cx, cy);
          for (let i = 0; i < 10; i++) {
            await page.mouse.wheel(0, -120);
            await page.waitForTimeout(80);
          }
          await page.waitForTimeout(500);
          const zoomPath = getSavePath('tradingview', `${pair}_${tf.label}_price_zoom`);
          await page.screenshot({ fullPage: false, path: zoomPath, type: 'png' });
          log('🔍', `${pair} ${tf.label} 줌 캡처 완료`);

          // Alt+R로 차트 뷰 리셋 → 재포지셔닝
          await page.keyboard.press('Alt+r');
          await page.waitForTimeout(800);
          await positionChart(page, width, height);
        } catch (zoomErr) {
          log('⚠️', `${pair} ${tf.label} 줌 캡처 실패: ${zoomErr.message}`);
        }

        // ④ vrvp — 우측 25% 영역 크롭
        try {
          const vrvpPath = getSavePath('tradingview', `${pair}_${tf.label}_vrvp`);
          await page.screenshot({
            fullPage: false,
            path: vrvpPath,
            type: 'png',
            clip: {
              x: Math.round(width * 0.75),
              y: 0,
              width: Math.round(width * 0.25),
              height: Math.round(height * 0.85),
            },
          });
          log('📊', `${pair} ${tf.label} VRVP 크롭 완료`);
        } catch (vrvpErr) {
          log('⚠️', `${pair} ${tf.label} VRVP 크롭 실패: ${vrvpErr.message}`);
        }

        // ⑤ indicators — 보조지표 패널 크롭 (DOM y좌표 탐색, 실패 시 65% 폴백)
        try {
          const indicatorY = await page.evaluate(() => {
            const panes = document.querySelectorAll('[class*="pane-container"]');
            if (panes.length >= 2) return Math.round(panes[1].getBoundingClientRect().top);
            return null;
          }).catch(() => null);
          const clipY = indicatorY ?? Math.round(height * 0.65);
          const indPath = getSavePath('tradingview', `${pair}_${tf.label}_indicators`);
          await page.screenshot({
            fullPage: false,
            path: indPath,
            type: 'png',
            clip: {
              x: 0,
              y: clipY,
              width: width - 80,
              height: height - clipY - 20,
            },
          });
          log('📈', `${pair} ${tf.label} 지표 패널 크롭 완료`);
        } catch (indErr) {
          log('⚠️', `${pair} ${tf.label} 지표 패널 크롭 실패: ${indErr.message}`);
        }
      } catch (err) {
        log('❌', `${pair} ${tf.label} 캡처 실패: ${err.message}`);
      }
    }
  }

  await context.close();
  log('📊', `TradingView 캡처 완료 — ${PAIRS.length * TIMEFRAMES.length}장`);
}

// ─── Coinglass 캡처 ─────────────────────────────────────

async function captureCoinglass(_browser) {
  log('🔥', 'Coinglass 청산 히트맵 캡처 시작...');

  const sessionPath = sessionExists('coinglass-session.json');
  if (sessionPath) {
    log('🔑', 'Coinglass 세션 로드 완료');
  } else {
    log('⚠️', 'Coinglass 세션 없음 — 로그인 필요할 수 있음');
    log('💡', '  → npm run import-cookies:coinglass 으로 세션 저장 후 재실행');
  }

  // Cloudflare + 로그인 우회: 실제 Chrome 브라우저 사용
  const chromeBrowser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--window-size=1920,1080', '--no-sandbox'],
  });

  const contextOpts = { viewport: VIEWPORT, deviceScaleFactor: DEVICE_SCALE };
  if (sessionPath) contextOpts.storageState = sessionPath;

  const context = await chromeBrowser.newContext(contextOpts);
  const page = await context.newPage();

  for (const target of COINGLASS_TARGETS) {
    try {
      const url = target.coin
        ? `https://www.coinglass.com/pro/futures/${target.path}?coin=${target.coin}&type=symbol`
        : `https://www.coinglass.com/pro/futures/${target.path}`;
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // 히트맵 렌더링 대기 (Canvas/WebGL 기반)
      await page.waitForSelector('canvas', { timeout: 15000 }).catch(() => {});
      await page.waitForTimeout(5000);

      // 로그인 팝업 닫기 시도
      const closeSelectors = [
        'button[aria-label="Close"]',
        'button[aria-label="close"]',
        '.modal-close',
        '.close-btn',
        'button.close',
        '[data-testid="close"]',
        // Coinglass 팝업 × 버튼 (SVG 아이콘 포함 버튼)
        'div[role="dialog"] button',
        '.ant-modal-close',
        '.ant-modal-close-x',
      ];
      for (const sel of closeSelectors) {
        const btn = page.locator(sel).first();
        if (await btn.isVisible({ timeout: 1000 }).catch(() => false)) {
          await btn.click().catch(() => {});
          await page.waitForTimeout(500);
          break;
        }
      }
      // 위에서 못 닫았으면 Escape 시도
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);

      const savePath = getSavePath('coinglass', `${target.pair}_liquidation_heatmap`);
      await page.screenshot({ fullPage: false, path: savePath, type: 'png' });
      log('✅', `Coinglass ${target.pair} 청산 히트맵 캡처 완료`);
    } catch (err) {
      log('❌', `Coinglass ${target.pair} 실패: ${err.message}`);
    }
  }

  await context.close();
  await chromeBrowser.close();
  log('🔥', `Coinglass 캡처 완료 — ${COINGLASS_TARGETS.length}장`);
}

// ─── Coinalyze 캡처 ─────────────────────────────────────

async function captureCoinalyze(_browser) {
  log('📈', 'Coinalyze 캡처 시작...');

  const sessionPath = sessionExists('coinalyze-session.json');
  if (!sessionPath) {
    log('⚠️', 'Coinalyze 세션 없음 — 건너뜀');
    log('💡', '  → npm run import-cookies:coinalyze 으로 세션 저장 후 재실행');
    return;
  }
  log('🔑', 'Coinalyze 세션 로드 완료');

  // Cloudflare 우회: 실제 Chrome 브라우저로 별도 실행
  const chromeBrowser = await chromium.launch({
    channel: 'chrome',
    headless: false,
    args: ['--window-size=1920,1080', '--no-sandbox'],
  });

  const context = await chromeBrowser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    storageState: sessionPath,
  });
  const page = await context.newPage();

  try {
    // 메인 페이지: 전 코인 OI / Volume / FR 요약 테이블
    await page.goto('https://coinalyze.net/', { waitUntil: 'domcontentloaded', timeout: 30000 });

    // 테이블 데이터 로딩 대기
    await page.waitForTimeout(5000);

    const savePath = getSavePath('coinalyze', 'main_overview');
    await page.screenshot({ fullPage: false, path: savePath, type: 'png' });
    log('✅', 'Coinalyze 메인 OI/Volume/FR 캡처 완료');
  } catch (err) {
    log('❌', `Coinalyze 메인 캡처 실패: ${err.message}`);
  }

  await context.close();
  await chromeBrowser.close();
  log('📈', 'Coinalyze 캡처 완료 — 1장');
}

// ─── Hyblock 캡처 ────────────────────────────────────────

async function captureHyblock(browser) {
  log('💧', 'Hyblock Capital 캡처 시작...');

  const sessionPath = sessionExists('hyblock-session.json');
  if (!sessionPath) {
    log('⚠️', 'Hyblock 세션 없음 — 로그인 필요. 건너뜀.');
    log('💡', '  → node scripts/save-session.js hyblock 으로 세션 저장 후 재실행');
    return;
  }

  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    storageState: sessionPath,
  });
  const page = await context.newPage();

  for (const target of HYBLOCK_TARGETS) {
    try {
      const url = `https://www.hyblockcapital.com/liquidationlevel/${target.slug}`;
      await page.goto(url, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(5000);

      const savePath = getSavePath('hyblock', `${target.pair}_liquidation`);
      await page.screenshot({ fullPage: false, path: savePath, type: 'png' });
      log('✅', `Hyblock ${target.pair} 유동성 레벨 캡처 완료`);
    } catch (err) {
      log('❌', `Hyblock ${target.pair} 실패: ${err.message}`);
    }
  }

  await context.close();
  log('💧', 'Hyblock 캡처 완료');
}

// ─── 메인 실행 ───────────────────────────────────────────

(async () => {
  const args = process.argv.slice(2);
  const tvOnly = args.includes('--tv-only');
  const ofOnly = args.includes('--orderflow-only');

  log('🚀', `=== 차트 캡처 시작 (${getDateDir()}) ===`);
  log('📋', `페어: ${PAIRS.join(', ')}`);
  log('📋', `타임프레임: ${TIMEFRAMES.map((t) => t.label).join(', ')}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--window-size=1920,1080', '--no-sandbox'],
  });

  try {
    if (!ofOnly) {
      await captureTradingView(browser);
    }

    if (!tvOnly) {
      await captureCoinglass(browser);
      await captureCoinalyze(browser);
      await captureHyblock(browser);
    }
  } catch (err) {
    log('💥', `치명적 오류: ${err.message}`);
    console.error(err);
  } finally {
    await browser.close();
  }

  // 결과 요약
  const dateDir = getDateDir();
  const ssDir = path.join(__dirname, '..', 'screenshots', dateDir);
  let totalFiles = 0;
  if (fs.existsSync(ssDir)) {
    const countFiles = (dir) => {
      let count = 0;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
        else if (entry.name.endsWith('.png') || entry.name.endsWith('.txt')) count++;
      }
      return count;
    };
    totalFiles = countFiles(ssDir);
  }

  log('🎉', `=== 캡처 완료 — 총 ${totalFiles}장 저장됨 ===`);
  log('📂', `저장 위치: screenshots/${dateDir}/`);
})();
