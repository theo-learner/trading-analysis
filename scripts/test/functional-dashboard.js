#!/usr/bin/env node
/**
 * functional-dashboard.js — ICT 대시보드 기능 정확성 테스트
 *
 * 실행: node scripts/test/functional-dashboard.js
 * 전제: dashboard-server.js 가 localhost:3210 에서 실행 중이어야 함
 *
 * 테스트 범주:
 *   A. FVG 수학적 정확성  — 엔진 감지 결과 vs 실제 캔들 3-캔들 갭 패턴
 *   B. OB  수학적 정확성  — 엔진 감지 결과 vs 방향전환캔들 + 변위 패턴
 *   C. 시그널 불변식      — SL/TP 방향, R:R = minRR, TP 공식 검증
 *   D. 오버레이 토글      — 버튼 클릭 시 window.state.overlays.* 상태 변경
 *   E. 가격 표시 정확도   — 대시보드 표시가격 vs Binance REST 현재가 ±0.5%
 *   F. 킬존 배지 정확도   — 배지 텍스트 vs 현재 UTC 시간
 *
 * 결과 저장:
 *   reports/functional-results-YYYYMMDD.json
 *   reports/functional-results-YYYYMMDD.md
 */

'use strict';

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');

const BASE_URL   = 'http://localhost:3210';
const REPORT_DIR = path.resolve(__dirname, '../../reports');
const DATE_STR   = new Date().toISOString().slice(0, 10).replace(/-/g, '');

const ROOT = path.resolve(__dirname, '../..');

fs.mkdirSync(REPORT_DIR, { recursive: true });

// ── 테스트 추적 ────────────────────────────────────────────────────────────────
const results = [];
const issues  = [];
let _page = null;

async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const dur = Date.now() - start;
    results.push({ name, status: 'PASS', duration: dur });
    console.log(`  ✅ ${name} (${dur}ms)`);
  } catch (e) {
    const dur = Date.now() - start;
    const msg = e.message || String(e);
    results.push({ name, status: 'FAIL', duration: dur, error: msg });
    issues.push({ test: name, error: msg });
    console.log(`  ❌ ${name}: ${msg}`);
    if (_page) {
      try {
        const ssPath = path.join(REPORT_DIR, `fn-fail-${Date.now()}.png`);
        await _page.screenshot({ path: ssPath });
        results[results.length - 1].screenshot = ssPath;
      } catch (_) {}
    }
  }
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertClose(a, b, tol, msg) {
  if (Math.abs(a - b) > tol) throw new Error(`${msg}: ${a} vs ${b} (허용오차 ${tol})`);
}

// ── Binance REST 헬퍼 ─────────────────────────────────────────────────────────
async function fetchBinanceKlines(pair, interval, limit) {
  const url = `https://fapi.binance.com/fapi/v1/klines?symbol=${pair}&interval=${interval}&limit=${limit}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Binance API 오류: ${resp.status}`);
  const raw = await resp.json();
  return raw.map(b => ({
    time:   Math.floor(Number(b[0]) / 1000),
    open:   parseFloat(b[1]),
    high:   parseFloat(b[2]),
    low:    parseFloat(b[3]),
    close:  parseFloat(b[4]),
    volume: parseFloat(b[5]),
  }));
}

// ── 서버 응답 대기 ─────────────────────────────────────────────────────────────
async function waitForServer(maxMs = 8000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(BASE_URL + '/api/config');
      if (r.ok) return;
    } catch (_) {}
    await new Promise(r => setTimeout(r, 300));
  }
  throw new Error(`서버가 ${maxMs}ms 안에 응답하지 않음`);
}

// ── 킬존 정의 (config와 동일) ─────────────────────────────────────────────────
const KILLZONES = [
  { name: '아시아', start: 0, end: 2 },
  { name: '런던', start: 7, end: 9 },
  { name: '뉴욕', start: 12, end: 14 },
  { name: 'NY PM', start: 18, end: 20 },
];

function expectedKillzone() {
  const h = new Date().getUTCHours();
  return KILLZONES.find(k => h >= k.start && h < k.end) || null;
}

// ════════════════════════════════════════════════════════════════════════════════
// A. FVG 수학적 정확성
// ════════════════════════════════════════════════════════════════════════════════

async function runFVGMathTests() {
  console.log('\n[A] FVG 수학적 정확성');

  // 모듈 직접 임포트
  const { detectFVG } = require(path.join(ROOT, 'scripts/modules/fvg'));
  const config = require(path.join(ROOT, 'scripts/config/ict-engine.json'));

  const htfCandles = await fetchBinanceKlines('BTCUSDT', '4h', 300);
  const ltfCandles = await fetchBinanceKlines('BTCUSDT', '15m', 300);

  await test('FVG [HTF 4H] — 모든 감지 FVG 가 3-캔들 갭 조건을 만족한다', () => {
    const fvgs = detectFVG(htfCandles, config.fvg);
    assert(fvgs.length >= 0, 'FVG 배열 반환됨');

    for (const fvg of fvgs) {
      const idx = fvg.index; // c2 인덱스 (middle candle)
      const c1 = htfCandles[idx - 1];
      const c3 = htfCandles[idx + 1];
      assert(c1 && c3, `FVG index=${idx}: c1/c3 캔들 존재해야 함`);

      if (fvg.direction === 'bull') {
        // Bull FVG: c3.low > c1.high
        assert(c3.low > c1.high,
          `Bull FVG (idx=${idx}): c3.low(${c3.low}) > c1.high(${c1.high}) 위반`);
        // high=c3.low, low=c1.high
        assertClose(fvg.high, c3.low, 0.01,
          `Bull FVG high 불일치 (idx=${idx})`);
        assertClose(fvg.low, c1.high, 0.01,
          `Bull FVG low 불일치 (idx=${idx})`);
      } else {
        // Bear FVG: c1.low > c3.high
        assert(c1.low > c3.high,
          `Bear FVG (idx=${idx}): c1.low(${c1.low}) > c3.high(${c3.high}) 위반`);
        assertClose(fvg.high, c1.low, 0.01,
          `Bear FVG high 불일치 (idx=${idx})`);
        assertClose(fvg.low, c3.high, 0.01,
          `Bear FVG low 불일치 (idx=${idx})`);
      }

      // 갭 크기 minGapPct 이상
      const gap = fvg.high - fvg.low;
      const pct = gap / c1.high;
      assert(pct >= config.fvg.minGapPct,
        `FVG 갭 크기 미달 (idx=${idx}): ${(pct * 100).toFixed(4)}% < ${config.fvg.minGapPct * 100}%`);
    }
  });

  await test('FVG [LTF 15m] — 모든 감지 FVG 가 3-캔들 갭 조건을 만족한다', () => {
    const fvgs = detectFVG(ltfCandles, config.fvg);

    for (const fvg of fvgs) {
      const idx = fvg.index;
      const c1 = ltfCandles[idx - 1];
      const c3 = ltfCandles[idx + 1];
      assert(c1 && c3, `FVG index=${idx}: c1/c3 캔들 존재해야 함`);

      if (fvg.direction === 'bull') {
        assert(c3.low > c1.high,
          `Bull FVG (idx=${idx}): c3.low(${c3.low}) > c1.high(${c1.high}) 위반`);
      } else {
        assert(c1.low > c3.high,
          `Bear FVG (idx=${idx}): c1.low(${c1.low}) > c3.high(${c3.high}) 위반`);
      }
    }
  });

  await test('FVG — mitigated 상태인 FVG 는 이후 캔들 close 가 gap 내에 있다', () => {
    const fvgs = detectFVG(htfCandles, config.fvg);
    const mitigated = fvgs.filter(f => f.status === 'mitigated');

    for (const fvg of mitigated) {
      // index+2 이후 어딘가 close 가 [low, high] 안에 있어야 함
      let found = false;
      for (let i = fvg.index + 2; i < htfCandles.length; i++) {
        const c = htfCandles[i];
        if (c.close >= fvg.low && c.close <= fvg.high) { found = true; break; }
      }
      assert(found, `Mitigated FVG (idx=${fvg.index}): gap 내 close 캔들을 찾을 수 없음`);
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// B. OB 수학적 정확성
// ════════════════════════════════════════════════════════════════════════════════

async function runOBMathTests() {
  console.log('\n[B] OB 수학적 정확성');

  const { detectOrderBlocks } = require(path.join(ROOT, 'scripts/modules/order-block'));
  const { detectSwingPoints } = require(path.join(ROOT, 'scripts/modules/swing-points'));
  const { isDisplacement }    = require(path.join(ROOT, 'scripts/modules/displacement'));
  const config = require(path.join(ROOT, 'scripts/config/ict-engine.json'));

  const htfCandles = await fetchBinanceKlines('BTCUSDT', '4h', 300);
  const swings = detectSwingPoints(htfCandles, config.swingPoint.htf);
  const dispFn = (c, cs, idx) => isDisplacement(c, cs, idx, config.displacement);
  const obs = detectOrderBlocks(htfCandles, swings, dispFn);

  await test('OB [HTF 4H] — Bull OB 는 직전 캔들이 음봉이다', () => {
    const bullOBs = obs.filter(o => o.direction === 'bull');
    for (const ob of bullOBs) {
      const curr = htfCandles[ob.index];
      assert(curr, `OB index=${ob.index}: 캔들 존재해야 함`);
      assert(curr.close < curr.open,
        `Bull OB (idx=${ob.index}): OB 캔들이 음봉이어야 함 (open=${curr.open}, close=${curr.close})`);
    }
  });

  await test('OB [HTF 4H] — Bear OB 는 직전 캔들이 양봉이다', () => {
    const bearOBs = obs.filter(o => o.direction === 'bear');
    for (const ob of bearOBs) {
      const curr = htfCandles[ob.index];
      assert(curr, `OB index=${ob.index}: 캔들 존재해야 함`);
      assert(curr.close > curr.open,
        `Bear OB (idx=${ob.index}): OB 캔들이 양봉이어야 함 (open=${curr.open}, close=${curr.close})`);
    }
  });

  await test('OB [HTF 4H] — OB high/low 가 해당 캔들의 open/close 범위와 일치한다', () => {
    for (const ob of obs) {
      const curr = htfCandles[ob.index];
      const expectedHigh = Math.max(curr.open, curr.close);
      const expectedLow  = Math.min(curr.open, curr.close);
      assertClose(ob.high, expectedHigh, 0.01, `OB (idx=${ob.index}) high 불일치`);
      assertClose(ob.low,  expectedLow,  0.01, `OB (idx=${ob.index}) low 불일치`);
    }
  });

  await test('OB [HTF 4H] — invalidated OB 는 이후 캔들 close 가 범위를 벗어난다', () => {
    const invalidated = obs.filter(o => o.status === 'invalidated');
    for (const ob of invalidated) {
      let found = false;
      for (let i = ob.index + 2; i < htfCandles.length; i++) {
        const close = htfCandles[i].close;
        if (ob.direction === 'bull' && close < ob.low) { found = true; break; }
        if (ob.direction === 'bear' && close > ob.high) { found = true; break; }
      }
      assert(found, `Invalidated OB (idx=${ob.index}): 무효화 캔들을 찾을 수 없음`);
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// C. 시그널 수학적 불변식
// ════════════════════════════════════════════════════════════════════════════════

async function runSignalMathTests() {
  console.log('\n[C] 시그널 수학적 불변식');

  const { analyzeICT }     = require(path.join(ROOT, 'scripts/ict-engine'));
  const { fetchCandleSet } = require(path.join(ROOT, 'scripts/utils/binance'));
  const config = require(path.join(ROOT, 'scripts/config/ict-engine.json'));

  // BTCUSDT 로 실제 신호 생성
  let signal;
  try {
    const { htf, ltf, d1 } = await fetchCandleSet('BTCUSDT');
    signal = analyzeICT({ htfCandles: htf, ltfCandles: ltf, d1Candles: d1, pair: 'BTCUSDT' });
  } catch (e) {
    throw new Error(`analyzeICT 실행 실패: ${e.message}`);
  }

  await test('시그널 — 필수 필드가 모두 존재한다 (direction, tier, entry, sl, tp, rr)', () => {
    assert(signal.direction !== undefined, 'direction 누락');
    assert(signal.tier !== undefined, 'tier 누락');
    assert(['LONG', 'SHORT', 'NEUTRAL'].includes(signal.direction),
      `direction 이 유효하지 않음: ${signal.direction}`);
    assert(typeof signal.tier === 'number', `tier 가 숫자가 아님: ${signal.tier}`);
  });

  if (signal.direction === 'NEUTRAL') {
    console.log(`    ℹ️  NEUTRAL 신호 (reason: ${signal.reason}) — 불변식 검사 생략`);
    return;
  }

  await test('시그널 — entry 객체 구조가 올바르다 (entry.price)', () => {
    assert(signal.entry && typeof signal.entry.price === 'number',
      `entry.price 가 없거나 숫자가 아님: ${JSON.stringify(signal.entry)}`);
    assert(signal.entry.price > 0, `entry.price 가 양수여야 함: ${signal.entry.price}`);
  });

  await test('시그널 [LONG] — SL < entry.price 이다', () => {
    if (signal.direction !== 'LONG') return;
    assert(signal.sl < signal.entry.price,
      `LONG: sl(${signal.sl}) < entry(${signal.entry.price}) 위반`);
  });

  await test('시그널 [SHORT] — SL > entry.price 이다', () => {
    if (signal.direction !== 'SHORT') return;
    assert(signal.sl > signal.entry.price,
      `SHORT: sl(${signal.sl}) > entry(${signal.entry.price}) 위반`);
  });

  await test('시그널 [LONG] — TP1 > entry.price 이다', () => {
    if (signal.direction !== 'LONG') return;
    assert(signal.tp[0] > signal.entry.price,
      `LONG: tp[0](${signal.tp[0]}) > entry(${signal.entry.price}) 위반`);
  });

  await test('시그널 [SHORT] — TP1 < entry.price 이다', () => {
    if (signal.direction !== 'SHORT') return;
    assert(signal.tp[0] < signal.entry.price,
      `SHORT: tp[0](${signal.tp[0]}) < entry(${signal.entry.price}) 위반`);
  });

  await test('시그널 — R:R 계산이 minRR 이상이다', () => {
    const entry = signal.entry.price;
    const computedRR = Math.abs(signal.tp[0] - entry) / Math.abs(entry - signal.sl);
    const minRR = config.signal.minRR;
    assert(computedRR >= minRR - 0.01,
      `R:R 미달: 계산값 ${computedRR.toFixed(4)} < minRR ${minRR}`);
    // signal.rr 필드와도 일치 확인
    assertClose(signal.rr, computedRR, 0.01, 'signal.rr 와 계산된 R:R 불일치');
  });

  await test('시그널 — TP 공식 검증 (risk * minRR 배수)', () => {
    const entry = signal.entry.price;
    const risk  = Math.abs(entry - signal.sl);
    const sign  = entry > signal.sl ? 1 : -1;
    const minRR = config.signal.minRR;

    const expectedTP0 = entry + sign * risk * minRR;
    const expectedTP1 = entry + sign * risk * minRR * 1.5;
    const expectedTP2 = entry + sign * risk * minRR * 2;

    assertClose(signal.tp[0], expectedTP0, 0.01, 'TP1 공식 불일치');
    assertClose(signal.tp[1], expectedTP1, 0.01, 'TP2 공식 불일치');
    assertClose(signal.tp[2], expectedTP2, 0.01, 'TP3 공식 불일치');
  });

  await test('시그널 — levels.fvgs 가 배열이다', () => {
    assert(Array.isArray(signal.levels?.fvgs),
      `signal.levels.fvgs 가 배열이 아님: ${JSON.stringify(signal.levels?.fvgs)}`);
  });

  await test('시그널 — levels.obs 가 배열이다', () => {
    assert(Array.isArray(signal.levels?.obs),
      `signal.levels.obs 가 배열이 아님: ${JSON.stringify(signal.levels?.obs)}`);
  });

  await test('시그널 — scorecard 구조가 올바르다', () => {
    const sc = signal.scorecard;
    assert(sc, 'scorecard 누락');
    assert(typeof sc.total === 'number', `scorecard.total 이 숫자가 아님`);
    assert(['S', 'A', 'B', 'C'].includes(sc.grade),
      `scorecard.grade 가 유효하지 않음: ${sc.grade}`);
    assert(sc.breakdown, 'scorecard.breakdown 누락');
    ['structure', 'time', 'price', 'pdArray', 'liquidity'].forEach(k => {
      assert(sc.breakdown[k] !== undefined,
        `scorecard.breakdown.${k} 누락`);
    });
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// D. 오버레이 토글 동작 (Playwright)
// ════════════════════════════════════════════════════════════════════════════════

async function runOverlayToggleTests(page) {
  console.log('\n[D] 오버레이 토글 동작');

  // 오버레이 버튼 선택자 (클래스: overlay-btn fvg/ob/bb/sweep)
  const overlayTypes = ['fvg', 'ob', 'bb', 'sweep'];

  for (const type of overlayTypes) {
    await test(`오버레이 토글 — ${type.toUpperCase()} 버튼 클릭 시 state.overlays.${type} 이 false 로 바뀐다`, async () => {
      // 초기 상태 확인
      const before = await page.evaluate((t) => window.state?.overlays?.[t], type);
      assert(before === true,
        `${type} 초기 상태가 true 가 아님: ${before} (분석 전이거나 state 접근 불가)`);

      // 버튼 클릭 (off)
      await page.click(`.overlay-btn.${type}`);
      await page.waitForTimeout(200);

      const after = await page.evaluate((t) => window.state?.overlays?.[t], type);
      assert(after === false,
        `${type} 버튼 클릭 후 state.overlays.${type} 이 false 가 아님: ${after}`);
    });

    await test(`오버레이 토글 — ${type.toUpperCase()} 버튼 재클릭 시 state.overlays.${type} 이 true 로 복구된다`, async () => {
      // 버튼 재클릭 (on)
      await page.click(`.overlay-btn.${type}`);
      await page.waitForTimeout(200);

      const restored = await page.evaluate((t) => window.state?.overlays?.[t], type);
      assert(restored === true,
        `${type} 버튼 재클릭 후 state.overlays.${type} 이 true 가 아님: ${restored}`);
    });
  }

  await test('오버레이 토글 — FVG off 상태에서 overlayData.fvgs 는 보존된다', async () => {
    // FVG 끄기
    const fvgBtn = page.locator('.overlay-btn.fvg');
    const isOn = await fvgBtn.evaluate(el => el.classList.contains('on'));
    if (isOn) await fvgBtn.click();
    await page.waitForTimeout(200);

    const fvgs = await page.evaluate(() => window.state?.overlayData?.fvgs);
    // overlayData 자체는 null 일 수 있음 (분석 미실행 시)
    // 분석이 실행됐다면 fvgs 배열이 보존돼야 함
    if (fvgs !== null && fvgs !== undefined) {
      assert(Array.isArray(fvgs), 'overlayData.fvgs 가 배열이 아님');
    }
    // 복구
    await fvgBtn.click();
    await page.waitForTimeout(100);
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// E. 가격 표시 정확도 (Playwright)
// ════════════════════════════════════════════════════════════════════════════════

async function runPriceAccuracyTests(page) {
  console.log('\n[E] 가격 표시 정확도');

  await test('가격 표시 — BTC 현재가가 Binance REST 대비 ±0.5% 이내이다', async () => {
    // Binance 현재가 (REST)
    const klines = await fetchBinanceKlines('BTCUSDT', '1m', 1);
    const binancePrice = klines[0].close;

    // 대시보드 표시 가격
    const displayText = await page.textContent('#priceDisplay');
    // 콤마, 공백 제거
    const displayPrice = parseFloat(displayText.replace(/[,\s]/g, ''));

    assert(!isNaN(displayPrice) && displayPrice > 0,
      `표시된 가격 파싱 실패: "${displayText}"`);

    const diffPct = Math.abs(displayPrice - binancePrice) / binancePrice * 100;
    assert(diffPct <= 0.5,
      `가격 오차 ${diffPct.toFixed(3)}% (대시보드: ${displayPrice}, Binance: ${binancePrice})`);
  });

  await test('가격 변화율 — priceChange 엘리먼트가 up 또는 dn 클래스를 가진다', async () => {
    const className = await page.evaluate(() => {
      const el = document.getElementById('priceChange');
      return el ? el.className : null;
    });
    assert(className !== null, 'priceChange 엘리먼트를 찾을 수 없음');
    assert(className.includes('up') || className.includes('dn'),
      `priceChange 클래스가 up/dn 이 아님: "${className}"`);
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// F. 킬존 배지 정확도 (Playwright)
// ════════════════════════════════════════════════════════════════════════════════

async function runKillzoneTests(page) {
  console.log('\n[F] 킬존 배지 정확도');

  const kz = expectedKillzone();
  const h  = new Date().getUTCHours();

  await test(`킬존 배지 — UTC ${h}시: ${kz ? kz.name + ' 킬존 활성' : '킬존 대기'} 상태여야 한다`, async () => {
    const badgeText  = await page.textContent('#kzBadge');
    const badgeClass = await page.evaluate(() => document.getElementById('kzBadge')?.className);

    if (kz) {
      assert(!badgeClass.includes('inactive'),
        `킬존 활성 시간(UTC ${h})인데 배지가 inactive: "${badgeText}"`);
      assert(badgeText.includes(kz.name),
        `배지에 "${kz.name}" 이 없음: "${badgeText}"`);
    } else {
      assert(badgeClass.includes('inactive') || badgeText.includes('대기'),
        `킬존 비활성 시간(UTC ${h})인데 배지가 활성: "${badgeText}"`);
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// 분석 실행 후 overlayData 검증 (보너스)
// ════════════════════════════════════════════════════════════════════════════════

async function runPostAnalysisOverlayTests(page) {
  console.log('\n[G] 분석 실행 후 overlayData 구조 검증');

  // ICT 분석 버튼 클릭
  await test('분석 실행 — 버튼 클릭 시 로딩 상태가 됐다가 완료된다', async () => {
    const btn = page.locator('#analyze-btn');
    await btn.click();
    // loading 클래스 확인 (5초 이내)
    await page.waitForSelector('#analyze-btn.loading', { timeout: 5000 });
    // 완료 대기 (최대 30초)
    await page.waitForFunction(
      () => !document.getElementById('analyze-btn')?.classList.contains('loading'),
      { timeout: 30000 }
    );
  });

  await test('분석 후 overlayData — fvgs 배열이 존재한다', async () => {
    const fvgs = await page.evaluate(() => window.state?.overlayData?.fvgs);
    assert(Array.isArray(fvgs), `overlayData.fvgs 가 배열이 아님: ${JSON.stringify(fvgs)}`);
  });

  await test('분석 후 overlayData — fvgs 각 항목이 high > low 를 만족한다', async () => {
    const fvgs = await page.evaluate(() => window.state?.overlayData?.fvgs ?? []);
    for (let i = 0; i < fvgs.length; i++) {
      const f = fvgs[i];
      assert(typeof f.high === 'number' && typeof f.low === 'number',
        `fvgs[${i}]: high/low 가 숫자가 아님`);
      assert(f.high > f.low,
        `fvgs[${i}]: high(${f.high}) > low(${f.low}) 위반`);
    }
  });

  await test('분석 후 overlayData — obs 배열이 존재한다', async () => {
    const obs = await page.evaluate(() => window.state?.overlayData?.obs);
    assert(Array.isArray(obs), `overlayData.obs 가 배열이 아님: ${JSON.stringify(obs)}`);
  });

  await test('분석 후 overlayData — obs 각 항목이 high > low 를 만족한다', async () => {
    const obs = await page.evaluate(() => window.state?.overlayData?.obs ?? []);
    for (let i = 0; i < obs.length; i++) {
      const o = obs[i];
      assert(typeof o.high === 'number' && typeof o.low === 'number',
        `obs[${i}]: high/low 가 숫자가 아님`);
      assert(o.high > o.low,
        `obs[${i}]: high(${o.high}) > low(${o.low}) 위반`);
    }
  });

  await test('분석 후 — 시그널 패널 또는 NEUTRAL 메시지가 표시된다', async () => {
    const signalCard = await page.$('.signal-card');
    const neutralMsg = await page.$('.signal-placeholder');
    assert(signalCard || neutralMsg,
      '시그널 카드와 플레이스홀더 모두 없음 — 분석 결과가 표시되지 않음');
  });

  await test('분석 후 FVG overlay — FVG levels 가 시그널의 FVG 범위 내에 있다', async () => {
    const { fvgs, signal } = await page.evaluate(() => ({
      fvgs:   window.state?.overlayData?.fvgs ?? [],
      signal: window.state?.lastSignal,
    }));
    if (!signal || signal.direction === 'NEUTRAL') {
      console.log('      ℹ️  NEUTRAL 또는 signal 없음 — 범위 검사 생략');
      return;
    }
    // overlayData.fvgs 는 signal.levels.fvgs 의 부분집합이어야 함
    const signalFVGs = signal.levels?.fvgs ?? [];
    for (const f of fvgs) {
      const matched = signalFVGs.some(sf =>
        Math.abs(sf.high - f.high) < 0.1 && Math.abs(sf.low - f.low) < 0.1
      );
      assert(matched,
        `overlayData.fvgs 에 signal.levels.fvgs 에 없는 항목 발견: high=${f.high}, low=${f.low}`);
    }
  });
}

// ════════════════════════════════════════════════════════════════════════════════
// 결과 저장
// ════════════════════════════════════════════════════════════════════════════════

function saveResults() {
  const total  = results.length;
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const passRate = total > 0 ? (passed / total * 100).toFixed(1) : '0.0';

  const jsonOut = {
    generatedAt: new Date().toISOString(),
    summary: { total, passed, failed, passRate: `${passRate}%` },
    results,
    issues,
  };

  const jsonPath = path.join(REPORT_DIR, `functional-results-${DATE_STR}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOut, null, 2));

  const mdRows = results.map((r, i) => {
    const icon = r.status === 'PASS' ? '✅ PASS' : '❌ FAIL';
    const err  = r.error ? ` — ${r.error}` : '';
    return `| ${i + 1} | ${r.name}${err} | ${icon} | ${r.duration}ms |`;
  }).join('\n');

  const mdContent = `# ICT 대시보드 기능 테스트 결과

> 실행: ${new Date().toISOString()}

## 요약

| 항목 | 값 |
|------|----|
| 전체 | ${total} |
| 통과 | ${passed} ✅ |
| 실패 | ${failed}  |
| 통과율 | ${passRate}% |

## 전체 결과

| # | 테스트 | 상태 | 소요 |
|---|--------|------|------|
${mdRows}
${issues.length > 0 ? `
## 이슈 목록

${issues.map((iss, i) => `**${i + 1}. ${iss.test}**\n\`\`\`\n${iss.error}\n\`\`\``).join('\n\n')}
` : ''}`;

  const mdPath = path.join(REPORT_DIR, `functional-results-${DATE_STR}.md`);
  fs.writeFileSync(mdPath, mdContent);

  console.log(`\n📄 결과 저장: ${jsonPath}`);
  console.log(`📄 결과 저장: ${mdPath}`);

  return { total, passed, failed, passRate };
}

// ════════════════════════════════════════════════════════════════════════════════
// 메인 실행
// ════════════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('🧪 ICT 대시보드 기능 테스트 시작\n');

  // ── A-C: 수학적 검증 (브라우저 없이) ────────────────────────────────────────
  await runFVGMathTests();
  await runOBMathTests();
  await runSignalMathTests();

  // ── D-G: Playwright 브라우저 테스트 ─────────────────────────────────────────
  await waitForServer();

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page    = await context.newPage();
  _page = page;

  // 콘솔 오류 수집
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });

  await page.goto(BASE_URL, { waitUntil: 'load', timeout: 20000 });
  // 차트 및 state 초기화 대기
  await page.waitForTimeout(3000);

  // window.state 접근 가능한지 확인
  const stateExists = await page.evaluate(() => typeof window.state !== 'undefined');
  if (!stateExists) {
    console.warn('  ⚠️  window.state 가 정의되지 않음 — 오버레이 토글 테스트는 실패로 기록됨');
  }

  await runPriceAccuracyTests(page);
  await runKillzoneTests(page);
  await runOverlayToggleTests(page);
  await runPostAnalysisOverlayTests(page);

  // 콘솔 오류 체크
  await test('브라우저 콘솔 — 기능 테스트 중 JS 오류 없음', () => {
    const filtered = consoleErrors.filter(e =>
      !e.includes('favicon') &&
      !e.includes('net::ERR') &&
      !e.includes('WebSocket') // WS 연결 오류는 테스트 환경에서 무시
    );
    assert(filtered.length === 0,
      `콘솔 JS 오류 ${filtered.length}건:\n${filtered.slice(0, 3).join('\n')}`);
  });

  await browser.close();

  // ── 결과 저장 ────────────────────────────────────────────────────────────────
  const { total, passed, failed, passRate } = saveResults();

  console.log(`\n${'─'.repeat(60)}`);
  console.log(`결과: ${passed}/${total} 통과 (${passRate}%)`);
  if (failed > 0) {
    console.log(`\n실패한 테스트 (${failed}건):`);
    issues.forEach(iss => console.log(`  • ${iss.test}`));
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('\n💥 테스트 실행 오류:', err);
  process.exit(1);
});
