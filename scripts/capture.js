/**
 * capture.js — TradingView 멀티TF + 오더플로우 플랫폼 자동 캡처
 *
 * 사용법: node scripts/capture.js [--tv-only] [--orderflow-only] [--coinalyze-only]
 *
 * 캡처 대상:
 *   TradingView : BTCUSDT, ETHUSDT, SOLUSDT, HYPEUSDT × 1H, 4H, 1D
 *   Coinglass   : BTC, ETH, SOL, HYPE 청산 히트맵
 *   Coinalyze   : 전체 OI + 펀딩비 메인 페이지 (스크린샷) + API 데이터
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

// 24h 변화율 교차 검증 타겟
const CHANGE24H_TARGETS = [
  { pair: 'BTCUSDT', coinglass: 'BTC',  coinalyze: 'btcusdtperp-binance' },
  { pair: 'ETHUSDT', coinglass: 'ETH',  coinalyze: 'ethusdtperp-binance' },
  { pair: 'SOLUSDT', coinglass: 'SOL',  coinalyze: 'solusdtperp-binance' },
  { pair: 'HYPEUSDT', coinglass: 'HYPE', coinalyze: 'hypeusdtperp-binance' },
];

const SESSION_DIR = path.join(__dirname, '..', 'sessions');
const VIEWPORT = { width: 1920, height: 1080 };

// ─── Coinalyze API ───────────────────────────────────────

const COINALYZE_API_BASE = 'https://api.coinalyze.net/v1';

function loadCoinalyzeApiKey() {
  try {
    const p = path.join(SESSION_DIR, 'coinalyze-api-key.txt');
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, 'utf-8').trim();
  } catch {
    return null;
  }
}

const COINALYZE_API_KEY = loadCoinalyzeApiKey();

// Coinalyze aggregated perpetual symbols (all exchanges)
const CA_API_SYMBOLS = {
  'BTCUSDT':  'BTCUSDT_PERP.A',
  'ETHUSDT':  'ETHUSDT_PERP.A',
  'SOLUSDT':  'SOLUSDT_PERP.A',
  'HYPEUSDT': 'HYPEUSDT_PERP.A',
};

function formatOiUsd(value) {
  if (value >= 1e9) return '$' + (value / 1e9).toFixed(2) + 'B';
  if (value >= 1e6) return '$' + (value / 1e6).toFixed(0) + 'M';
  return '$' + Math.round(value).toLocaleString();
}
const DEVICE_SCALE = 2; // Retina 품질

const CLEAN_LAYOUT_PATH = path.join(__dirname, 'config', 'clean-layout.json');

function loadCleanLayoutId() {
  try {
    if (!fs.existsSync(CLEAN_LAYOUT_PATH)) return null;
    const cfg = JSON.parse(fs.readFileSync(CLEAN_LAYOUT_PATH, 'utf-8'));
    return cfg.layoutId || null;
  } catch (e) {
    log('⚠️', `clean-layout.json 로드 실패: ${e.message}`);
    return null;
  }
}

const CLEAN_LAYOUT_ID = loadCleanLayoutId();

// ─── 유틸리티 ────────────────────────────────────────────

function getDateDir() {
  const now = new Date();
  // KST = UTC+9: toISOString()은 UTC 기준이라 08:00 KST = 전날 23:00 UTC가 됨
  const kst = new Date(now.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10).replace(/-/g, '');
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

    // 첫 번째는 OHLC (가격) + 오버레이 스터디(EMA 등), 이후는 서브패널 지표
    const legendValues = [];
    const legendTitles = [];

    // ②-a 메인 페인 EMA 파싱
    // DOM 구조: legendContainers[0]의 innerText 안에 EMA가 VRVP 등과 섞여 있음
    // 패턴: "EMA\n{length}\nclose\n{value}" (개행 구분)
    // 예: "EMA\n50\nclose\n72,291.1\nEMA\n200\nclose\n71,137.1\nEMA\n7\nclose\n74,005.7"
    if (legendContainers.length > 0) {
      const mainText = legendContainers[0].innerText || '';
      const emaRegex = /EMA\s+(\d+)\s+close\s+([\d,]+\.?\d*)/g;
      let m;
      while ((m = emaRegex.exec(mainText)) !== null) {
        const length = m[1];
        const value = m[2];
        legendTitles.push(`EMA ${length}`);
        legendValues.push(value);
      }
    }

    // ②-b 서브패널 지표 파싱 (RSI 등 — 기존 로직 유지)
    for (let i = 1; i < legendContainers.length; i++) {
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

    // ② -c 구조화된 EMA 필드 생성
    const ema = { '7': null, '50': null, '200': null };
    legendTitles.forEach((title, idx) => {
      const m = title.match(/^EMA\s*(\d+)/i);
      if (m) {
        const len = m[1];
        if (len in ema) {
          const raw = legendValues[idx];
          const parsed = raw ? parseFloat(raw.replace(/,/g, '')) : null;
          ema[len] = isNaN(parsed) ? null : parsed;
        }
      }
    });

    return {
      pair,
      tf,
      currentPrice: currentPrice || null,
      ema,
      legendValues,
      legendTitles,
      timestamp: new Date().toISOString(),
      _debug: {
        priceFound: currentPrice !== null,
        legendCount: legendValues.length,
        titlesCount: legendTitles.length,
        containerCount: legendContainers.length,
        emaFound: { '7': ema['7'] !== null, '50': ema['50'] !== null, '200': ema['200'] !== null },
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
  if (!CLEAN_LAYOUT_ID) {
    log('⚠️', 'CLEAN_LAYOUT_ID 없음 — 기본 레이아웃 사용 (사용자 드로잉이 캡처될 수 있음)');
  } else {
    log('🧹', `Clean layout 사용: ${CLEAN_LAYOUT_ID}`);
  }

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
      const url = CLEAN_LAYOUT_ID
        ? `https://www.tradingview.com/chart/${CLEAN_LAYOUT_ID}/?symbol=BINANCE:${pair}.P&interval=${tf.value}`
        : `https://www.tradingview.com/chart/?symbol=BINANCE:${pair}.P&interval=${tf.value}`;

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

        // 현재 캔들 위로 마우스 이동 — positionChart 후 현재 캔들은 x≈70% 위치
        // 드래그 후 마우스가 과거 캔들 위(x≈30%)에 있으면 legend가 과거 EMA 값을 표시함
        const currentCandleX = Math.round(width * 0.70);
        const currentCandleY = Math.round(height * 0.45);
        await page.mouse.move(currentCandleX, currentCandleY);
        await page.waitForTimeout(600); // legend 업데이트 대기

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
          cleanData.levels = LEVELS_CACHE[pair]?.[tf.label] ?? null;
          fs.writeFileSync(txtPath, JSON.stringify(cleanData, null, 2));

          // 디버깅 로그
          if (priceData.currentPrice === null || priceData.legendValues.length === 0) {
            log('⚠️', `${pair} ${tf.label} 가격 데이터 불완전 (price: ${priceData.currentPrice}, legends: ${priceData.legendValues.length})`);
          } else {
            const emaMissing = ['7', '50', '200'].filter(k => priceData.ema[k] === null);
            const emaWarn = emaMissing.length > 0 ? ` ⚠️ EMA 누락: ${emaMissing.map(k => 'EMA' + k).join(', ')}` : '';
            log('📝', `${pair} ${tf.label} 가격 데이터 저장 완료 (가격: ${priceData.currentPrice}, 지표: ${priceData.legendValues.length}${emaWarn})`);
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

        // ④ indicators — 보조지표 패널 크롭 (DOM y좌표 탐색, 실패 시 65% 폴백)
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

  // Cloudflare + 로그인 우회: 봇 감지 우회 플래그 (xvfb-run으로 가상 디스플레이 제공)
  const chromeBrowser = await chromium.launch({
    headless: false,
    args: [
      '--window-size=1920,1080',
      '--no-sandbox',
      '--disable-blink-features=AutomationControlled',
      '--disable-infobars',
      '--disable-dev-shm-usage',
    ],
  });

  const contextOpts = {
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  };
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

  // Cloudflare 우회: 봇 감지 우회 플래그 (xvfb-run으로 가상 디스플레이 제공)
  const chromeBrowser = await chromium.launch({
    headless: false,
    args: ['--window-size=1920,1080', '--no-sandbox', '--disable-blink-features=AutomationControlled'],
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

// ─── Price Structure Levels (OB / FVG / BSL / SSL) ───────

const LEVELS_CACHE = {}; // { BTCUSDT: { '1H': {...}, '4H': {...}, '1D': {...} }, ... }

const LEVEL_TF_MAP = { '1H': '1h', '4H': '4h', '1D': '1d' };

function findSwings(ohlc, n = 5) {
  const result = [];
  for (let i = n; i < ohlc.length - n; i++) {
    const hi = ohlc[i].h;
    const lo = ohlc[i].l;
    let isHigh = true, isLow = true;
    for (let j = i - n; j <= i + n; j++) {
      if (j === i) continue;
      if (ohlc[j].h >= hi) isHigh = false;
      if (ohlc[j].l <= lo) isLow  = false;
    }
    if (isHigh) result.push({ type: 'H', idx: i, price: hi });
    if (isLow)  result.push({ type: 'L', idx: i, price: lo });
  }
  return result;
}

function findFVG(ohlc) {
  const result = [];
  for (let i = 2; i < ohlc.length; i++) {
    const bull = ohlc[i].l > ohlc[i - 2].h; // bullish FVG
    const bear = ohlc[i].h < ohlc[i - 2].l; // bearish FVG
    if (!bull && !bear) continue;

    const top    = bull ? ohlc[i].l     : ohlc[i - 2].l;
    const bottom = bull ? ohlc[i - 2].h : ohlc[i].h;

    // unfilled check: 이후 캔들이 gap에 진입했는지 확인
    let filled = false;
    for (let k = i + 1; k < ohlc.length; k++) {
      if (bull && ohlc[k].l <= top)    { filled = true; break; }
      if (!bull && ohlc[k].h >= bottom) { filled = true; break; }
    }
    if (!filled) result.push({ type: bull ? 'bull' : 'bear', top, bottom, idx: i });
  }
  return result;
}

function findOrderBlocks(ohlc, swings) {
  const result = [];
  for (const sw of swings) {
    if (sw.idx < 1) continue;
    // BOS 직전 마지막 반대색 캔들
    for (let i = sw.idx - 1; i >= Math.max(0, sw.idx - 10); i--) {
      const c = ohlc[i];
      const bullCandle = c.c > c.o;
      if (sw.type === 'H' && !bullCandle) { // 하락 swing high 직전 → 베어리시 OB (= 마지막 하락봉)
        result.push({ type: 'bear', top: c.h, bottom: c.l, idx: i });
        break;
      }
      if (sw.type === 'L' && bullCandle) {  // 상승 swing low 직전 → 불리시 OB (= 마지막 상승봉)
        result.push({ type: 'bull', top: c.h, bottom: c.l, idx: i });
        break;
      }
    }
  }
  return result;
}

function clusterEqualLevels(swings, tolerance = 0.003) {
  const highs = swings.filter(s => s.type === 'H').map(s => s.price).sort((a, b) => b - a);
  const lows  = swings.filter(s => s.type === 'L').map(s => s.price).sort((a, b) => a - b);

  const cluster = (arr) => {
    const clusters = [];
    const used = new Set();
    for (let i = 0; i < arr.length; i++) {
      if (used.has(i)) continue;
      const group = [arr[i]];
      for (let j = i + 1; j < arr.length; j++) {
        if (used.has(j)) continue;
        if (Math.abs(arr[j] - arr[i]) / arr[i] <= tolerance) {
          group.push(arr[j]);
          used.add(j);
        }
      }
      if (group.length >= 2) {
        clusters.push(parseFloat((group.reduce((a, b) => a + b, 0) / group.length).toFixed(2)));
      }
    }
    return clusters;
  };

  return { bsl: cluster(highs), ssl: cluster(lows) };
}

function trimToNearest(levels, currentPrice, count = 3) {
  const dist = (p) => Math.abs(p - currentPrice);
  const trim = (arr) => {
    if (!arr || arr.length === 0) return [];
    return [...arr].sort((a, b) => dist(a) - dist(b)).slice(0, count * 2)
      .sort((a, b) => a - b);
  };

  const above = (arr) => arr.filter(p => p > currentPrice).sort((a, b) => a - b).slice(0, count);
  const below = (arr) => arr.filter(p => p < currentPrice).sort((a, b) => b - a).slice(0, count);

  const obLevels = [...new Set(levels.obs.map(o => parseFloat(o.bottom.toFixed(2))))];
  const fvgLevels = [
    ...levels.fvgs.filter(f => f.type === 'bull').map(f => parseFloat(f.bottom.toFixed(2))),
    ...levels.fvgs.filter(f => f.type === 'bear').map(f => parseFloat(f.top.toFixed(2))),
  ];
  const swingHighs = levels.swings.filter(s => s.type === 'H').map(s => parseFloat(s.price.toFixed(2)));
  const swingLows  = levels.swings.filter(s => s.type === 'L').map(s => parseFloat(s.price.toFixed(2)));

  return {
    ob:  { bull: below(obLevels), bear: above(obLevels) },
    fvg: { bull: below(fvgLevels), bear: above(fvgLevels) },
    bsl: above(levels.bsl),
    ssl: below(levels.ssl),
    swing_highs: above(swingHighs),
    swing_lows:  below(swingLows),
  };
}

function computeLevels(rawBars, currentPrice) {
  if (!Array.isArray(rawBars) || rawBars.length < 20) return null;
  const ohlc = rawBars.map(b => ({
    t: b[0], o: +b[1], h: +b[2], l: +b[3], c: +b[4],
  }));
  const swings = findSwings(ohlc, 5);
  const fvgs   = findFVG(ohlc);
  const obs    = findOrderBlocks(ohlc, swings);
  const { bsl, ssl } = clusterEqualLevels(swings, 0.003);
  return trimToNearest({ swings, fvgs, obs, bsl, ssl }, currentPrice, 3);
}

async function fetchPriceLevels() {
  log('📐', 'Price Structure Levels 수집 시작 (Binance klines)...');

  // 현재가 먼저 가져오기
  let prices = {};
  try {
    const priceData = await fetch('https://fapi.binance.com/fapi/v1/ticker/price').then(r => r.json());
    if (Array.isArray(priceData)) {
      for (const p of priceData) {
        if (PAIRS.includes(p.symbol)) prices[p.symbol] = parseFloat(p.price);
      }
    }
  } catch (e) {
    log('⚠️', `fetchPriceLevels: 현재가 조회 실패 — ${e.message}`);
  }

  const requests = [];
  for (const pair of PAIRS) {
    for (const [tfLabel, interval] of Object.entries(LEVEL_TF_MAP)) {
      requests.push(
        fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=${interval}&limit=300`)
          .then(r => r.json())
          .then(bars => ({ pair, tfLabel, bars }))
          .catch(e => { log('⚠️', `fetchPriceLevels ${pair} ${tfLabel}: ${e.message}`); return null; })
      );
    }
  }

  const results = await Promise.all(requests);
  for (const res of results) {
    if (!res) continue;
    const { pair, tfLabel, bars } = res;
    const cp = prices[pair] || 0;
    if (!LEVELS_CACHE[pair]) LEVELS_CACHE[pair] = {};
    LEVELS_CACHE[pair][tfLabel] = computeLevels(bars, cp);
  }

  const filled = Object.values(LEVELS_CACHE).reduce((acc, tf) => acc + Object.keys(tf).length, 0);
  log('📐', `Price Structure Levels 수집 완료 (${filled}/${PAIRS.length * 3} TF)`);
}

// ─── Coinalyze API 데이터 수집 ───────────────────────────

async function fetchCoinalyzeData() {
  log('📡', 'Coinalyze API 데이터 수집 시작...');

  if (!COINALYZE_API_KEY) {
    log('⚠️', 'coinalyze-api-key.txt 없음 — Coinalyze API 건너뜀');
    return;
  }

  const symbolStr = Object.values(CA_API_SYMBOLS).join(',');
  const now = Math.floor(Date.now() / 1000);
  const from24h = now - 24 * 3600;

  let oiData = [], frData = [], predFrData = [], oiHistData = [], priceData = [];
  // Binance klines: [openTime, o, h, l, c, vol, closeTime, quoteVol, trades, takerBuyBaseVol, takerBuyQuoteVol, ignore]
  const klineMap = {}; // pair -> bars[]

  try {
    const klinesRequests = Object.keys(CA_API_SYMBOLS).map(pair =>
      fetch(`https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=1h&limit=24`)
        .then(r => r.json())
        .then(bars => { klineMap[pair] = Array.isArray(bars) ? bars : []; })
    );

    [oiData, frData, predFrData, oiHistData, priceData] = await Promise.all([
      fetch(`${COINALYZE_API_BASE}/open-interest?symbols=${symbolStr}&api_key=${COINALYZE_API_KEY}`).then(r => r.json()),
      fetch(`${COINALYZE_API_BASE}/funding-rate?symbols=${symbolStr}&api_key=${COINALYZE_API_KEY}`).then(r => r.json()),
      fetch(`${COINALYZE_API_BASE}/predicted-funding-rate?symbols=${symbolStr}&api_key=${COINALYZE_API_KEY}`).then(r => r.json()),
      fetch(`${COINALYZE_API_BASE}/open-interest-history?symbols=${symbolStr}&interval=1hour&from=${from24h}&to=${now}&api_key=${COINALYZE_API_KEY}`).then(r => r.json()),
      fetch('https://fapi.binance.com/fapi/v1/ticker/price').then(r => r.json()),
      ...klinesRequests,
    ]);
  } catch (err) {
    log('❌', `API 호출 실패: ${err.message}`);
    return;
  }

  // 현재가 맵 (Binance Futures)
  const prices = {};
  if (Array.isArray(priceData)) {
    for (const p of priceData) {
      if (CA_API_SYMBOLS[p.symbol]) prices[p.symbol] = parseFloat(p.price);
    }
  }

  const result = {};
  for (const [pair, caSymbol] of Object.entries(CA_API_SYMBOLS)) {
    const price = prices[pair] || 0;

    // ① OI
    const oiEntry = Array.isArray(oiData) ? oiData.find(d => d.symbol === caSymbol) : null;
    const oiBase = oiEntry?.value || 0;
    const oiUsd  = oiBase * price;

    // ② OI 24h 변화 (from history)
    const oiHist   = Array.isArray(oiHistData) ? (oiHistData.find(d => d.symbol === caSymbol)?.history || []) : [];
    const oiOldest = oiHist.length > 0 ? oiHist[0].o : 0;
    const oiNewest = oiHist.length > 0 ? oiHist[oiHist.length - 1].c : oiBase;
    const oiChg24h = oiOldest > 0 ? (oiNewest - oiOldest) / oiOldest * 100 : 0;

    // ③ 펀딩비
    const frEntry     = Array.isArray(frData)     ? frData.find(d => d.symbol === caSymbol)     : null;
    const predFrEntry = Array.isArray(predFrData) ? predFrData.find(d => d.symbol === caSymbol) : null;
    const fundingRate      = frEntry?.value     || 0;
    const fundingRatePred  = predFrEntry?.value || 0;

    // ④ CVD 24H (Binance klines, 1h x 24봉)
    //    takerBuyBaseVol(idx 9), vol(idx 5)
    //    delta = takerBuy - takerSell = 2*takerBuy - vol
    const bars = klineMap[pair] || [];
    let cvdTotal = 0;
    let deltaFirst = 0, deltaSecond = 0;
    const mid = Math.floor(bars.length / 2);
    for (let i = 0; i < bars.length; i++) {
      const vol    = parseFloat(bars[i][5]);
      const buyVol = parseFloat(bars[i][9]);
      const delta  = 2 * buyVol - vol;
      cvdTotal += delta;
      if (i < mid) deltaFirst  += delta;
      else         deltaSecond += delta;
    }

    const fmtFr  = (n) => (n >= 0 ? '+' : '') + (n * 100).toFixed(4) + '%';
    const fmtChg = (n) => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

    result[pair] = {
      price_usd:              price > 0 ? parseFloat(price.toFixed(4)) : null,
      oi_base:                parseFloat(oiBase.toFixed(3)),
      oi_usd:                 price > 0 ? Math.round(oiUsd) : null,
      oi_usd_str:             price > 0 ? formatOiUsd(oiUsd) : 'N/A',
      oi_change_24h:          fmtChg(oiChg24h),
      oi_trend:               oiChg24h > 0 ? 'rising' : (oiChg24h < 0 ? 'falling' : 'flat'),
      funding_rate:           fmtFr(fundingRate),
      funding_rate_predicted: fmtFr(fundingRatePred),
      cvd_24h:                parseFloat(cvdTotal.toFixed(4)),
      cvd_direction:          cvdTotal >= 0 ? 'positive' : 'negative',
      cvd_trend:              deltaSecond > deltaFirst ? 'rising' : 'falling',
    };

    log('✅', `${pair}: OI ${result[pair].oi_usd_str} (${result[pair].oi_change_24h}), FR ${result[pair].funding_rate}, CVD ${result[pair].cvd_direction}/${result[pair].cvd_trend}`);
  }

  const saveDir  = getSaveDir('coinalyze');
  const savePath = path.join(saveDir, 'coinalyze_data.json');
  fs.writeFileSync(savePath, JSON.stringify({ generated_at: new Date().toISOString(), pairs: result }, null, 2));
  log('💾', `Coinalyze API 데이터 저장: ${savePath}`);
}

// ─── 24h 변화율 수집 (Coinglass + Coinalyze 교차 검증) ───

// 봇 감지 우회 Chrome 공통 옵션
function stealthChromeArgs() {
  return [
    '--window-size=1920,1080',
    '--no-sandbox',
    '--disable-blink-features=AutomationControlled',
    '--disable-infobars',
    '--disable-dev-shm-usage',
  ];
}

const STEALTH_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

// DOM에서 심볼별 24h 변화율 추출 (page.evaluate에 직접 전달)
const DOM_EXTRACT_PCT = (targets) => {
  const result = {};
  // 1단계: 테이블 행 탐색
  const rows = Array.from(document.querySelectorAll('tr'));
  for (const row of rows) {
    const cells = Array.from(row.querySelectorAll('td'));
    if (cells.length < 2) continue;
    const rowText = row.innerText || '';
    for (const sym of targets) {
      if (result[sym]) continue;
      if (!rowText.match(new RegExp(`\\b${sym}\\b`, 'i'))) continue;
      const pctMatch = rowText.match(/([+\-−][\d.]+%)/);
      if (pctMatch) result[sym] = pctMatch[1].replace('\u2212', '-');
    }
  }
  // 2단계: 테이블 없을 경우 페이지 전체 텍스트
  const missing = targets.filter(s => !result[s]);
  if (missing.length > 0) {
    const bodyText = document.body.innerText || '';
    for (const sym of missing) {
      const re = new RegExp(`\\b${sym}\\b[^\\n]{0,100}([+\\-\u2212][\\d.]+%)`, 'i');
      const m = bodyText.match(re);
      if (m) result[sym] = m[1].replace('\u2212', '-');
    }
  }
  return result;
};

async function captureChange24h(_browser) {
  log('📊', '24h 변화율 수집 시작 (Binance API + Coinalyze)...');

  const caSession = sessionExists('coinalyze-session.json');

  const binance = {};
  const coinalyze = {};

  // ① Binance Futures API — HTTP 직접 호출 (브라우저 불필요, 제한 없음)
  try {
    const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/24hr');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const tickers = await res.json();
    for (const ticker of tickers) {
      const target = CHANGE24H_TARGETS.find(t => t.pair === ticker.symbol);
      if (target) {
        const pct = parseFloat(ticker.priceChangePercent);
        binance[target.pair] = (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
        log('📈', `Binance ${target.pair}: ${binance[target.pair]}`);
      }
    }
  } catch (err) {
    log('⚠️', `Binance API 24h 추출 실패: ${err.message}`);
  }

  // ② Coinalyze — 독립 브라우저 (Coinglass 충돌과 무관하게 실행)
  {
    let caBrowser = null;
    try {
      caBrowser = await chromium.launch({
        headless: false,
        args: stealthChromeArgs(),
      });
      const ctx = await caBrowser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: DEVICE_SCALE,
        userAgent: STEALTH_UA,
        ...(caSession ? { storageState: caSession } : {}),
      });
      const page = await ctx.newPage();

      await page.goto('https://coinalyze.net/', { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

      const caSymbols = CHANGE24H_TARGETS.map(t => t.coinglass); // ['BTC','ETH','SOL','HYPE']
      const data = await page.evaluate(DOM_EXTRACT_PCT, caSymbols);
      for (const [sym, pct] of Object.entries(data)) {
        const target = CHANGE24H_TARGETS.find(t => t.coinglass === sym);
        if (target) { coinalyze[target.pair] = pct; log('📉', `Coinalyze ${sym}: ${pct}`); }
      }
      await ctx.close();
    } catch (err) {
      log('⚠️', `Coinalyze 24h 추출 실패: ${err.message}`);
    } finally {
      if (caBrowser) await caBrowser.close().catch(() => {});
    }
  }

  // ③ 교차 검증 및 최종값 결정
  const change24hData = {};
  for (const target of CHANGE24H_TARGETS) {
    const bn = binance[target.pair];
    const ca = coinalyze[target.pair];
    const sources = { binance: bn || null, coinalyze: ca || null };
    let value = null;
    let confidence = 'unknown';

    if (bn && ca) {
      const bnNum = parseFloat(bn);
      const caNum = parseFloat(ca);
      const diff = Math.abs(bnNum - caNum);

      if (diff <= 0.5) {
        const avg = (bnNum + caNum) / 2;
        value = (avg >= 0 ? '+' : '') + avg.toFixed(2) + '%';
        confidence = 'confirmed'; // 두 소스 일치
      } else if (diff <= 2.0) {
        const avg = (bnNum + caNum) / 2;
        value = (avg >= 0 ? '+' : '') + avg.toFixed(2) + '%';
        confidence = 'approximate'; // 소폭 차이
      } else {
        value = bn; // Binance 우선 (원본 소스)
        confidence = 'inconsistent';
        log('⚠️', `${target.pair} 불일치: Binance ${bn} vs Coinalyze ${ca}`);
      }
    } else if (bn) {
      value = bn;
      confidence = 'binance_only';
    } else if (ca) {
      value = ca;
      confidence = 'coinalyze_only';
    } else {
      log('⚠️', `${target.pair} 24h 변화율 수집 실패 (Binance + Coinalyze 모두 없음)`);
    }

    change24hData[target.pair] = { value, confidence, sources };
    if (value) log('✅', `${target.pair} 24h: ${value} (${confidence})`);
  }

  // 저장: tradingview 디렉토리에 함께 보관
  const saveDir = getSaveDir('tradingview');
  const savePath = path.join(saveDir, 'change24h_data.json');
  fs.writeFileSync(savePath, JSON.stringify(change24hData, null, 2));
  log('💾', `24h 변화율 저장 완료: ${savePath}`);
}

// ─── 메인 실행 ───────────────────────────────────────────

(async () => {
  const args = process.argv.slice(2);
  const tvOnly       = args.includes('--tv-only');
  const ofOnly       = args.includes('--orderflow-only');
  const changeOnly   = args.includes('--change24h-only');
  const caOnly       = args.includes('--coinalyze-only');

  log('🚀', `=== 차트 캡처 시작 (${getDateDir()}) ===`);
  log('📋', `페어: ${PAIRS.join(', ')}`);
  log('📋', `타임프레임: ${TIMEFRAMES.map((t) => t.label).join(', ')}`);

  const browser = await chromium.launch({
    headless: true,
    args: ['--window-size=1920,1080', '--no-sandbox'],
  });

  try {
    if (caOnly) {
      await fetchCoinalyzeData();
    } else if (changeOnly) {
      await captureChange24h(browser);
    } else {
      // Coinalyze API 먼저 수집 — TV 캡처와 타임스탬프 정렬
      await fetchCoinalyzeData();

      if (!ofOnly) {
        await fetchPriceLevels();
        await captureTradingView(browser);
      }

      if (!tvOnly) {
        await captureCoinglass(browser);
        await captureCoinalyze(browser);
        await captureHyblock(browser);
        await captureChange24h(browser);
      }
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
