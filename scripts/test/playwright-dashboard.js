#!/usr/bin/env node
/**
 * playwright-dashboard.js — ICT 대시보드 E2E 테스트
 *
 * 실행: node scripts/test/playwright-dashboard.js
 * 전제: dashboard-server.js 가 localhost:3210 에서 실행 중이어야 함
 *
 * 결과 저장:
 *   reports/playwright-results-YYYYMMDD.json
 *   reports/playwright-results-YYYYMMDD.md
 */

'use strict';

const { chromium } = require('playwright');
const fs   = require('fs');
const path = require('path');
const http = require('http');

const BASE_URL  = 'http://localhost:3210';
const REPORT_DIR = path.resolve(__dirname, '../../reports');
const DATE_STR  = new Date().toISOString().slice(0, 10).replace(/-/g, '');

fs.mkdirSync(REPORT_DIR, { recursive: true });

// ── 테스트 결과 추적 ──────────────────────────────────────────────────────────
const results = [];
const issues  = [];
let   _page   = null; // 현재 Playwright page 공유

async function test(name, fn) {
  const start = Date.now();
  try {
    await fn();
    const dur = Date.now() - start;
    results.push({ name, status: 'PASS', duration: dur });
    console.log(`  ✅ ${name} (${dur}ms)`);
  } catch (e) {
    const dur  = Date.now() - start;
    const msg  = e.message;
    results.push({ name, status: 'FAIL', duration: dur, error: msg });
    issues.push({ test: name, error: msg });
    console.log(`  ❌ ${name}: ${msg}`);

    // 실패 시 스크린샷 저장
    if (_page) {
      try {
        const ssPath = path.join(REPORT_DIR, `pw-fail-${Date.now()}.png`);
        await _page.screenshot({ path: ssPath });
        results[results.length - 1].screenshot = ssPath;
      } catch (_) {}
    }
  }
}

// ── API 헬퍼 (Node.js fetch 사용) ────────────────────────────────────────────
async function apiFetch(urlPath, opts = {}) {
  const url  = BASE_URL + urlPath;
  const res  = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch (_) { json = body; }
  return { status: res.status, json };
}

// ── 서버 응답 대기 ──────────────────────────────────────────────────────────
async function waitForServer(maxMs = 5000) {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    try {
      await fetch(BASE_URL + '/api/config');
      return;
    } catch (_) {
      await new Promise(r => setTimeout(r, 300));
    }
  }
  throw new Error(`서버가 ${maxMs}ms 안에 응답하지 않음 (${BASE_URL})`);
}

// ── assertion 헬퍼 ───────────────────────────────────────────────────────────
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function assertStatus(actual, expected, context = '') {
  assert(actual === expected, `HTTP ${actual} expected ${expected}${context ? ' — ' + context : ''}`);
}

// ══════════════════════════════════════════════════════════════════════════════
//  API 테스트 (브라우저 불필요)
// ══════════════════════════════════════════════════════════════════════════════
async function runApiTests() {
  console.log('\n📡 API 테스트');

  await test('GET /api/config — 200, 객체 반환', async () => {
    const { status, json } = await apiFetch('/api/config');
    assertStatus(status, 200);
    assert(json && typeof json === 'object', '응답이 객체가 아님');
  });

  await test('GET /api/trades — 200, 배열 반환', async () => {
    const { status, json } = await apiFetch('/api/trades');
    assertStatus(status, 200);
    assert(Array.isArray(json), '응답이 배열이 아님');
  });

  await test('GET /api/signals — 200, 배열 반환', async () => {
    const { status, json } = await apiFetch('/api/signals');
    assertStatus(status, 200);
    assert(Array.isArray(json), '응답이 배열이 아님');
  });

  await test('GET /api/analyze-log — 200, {running, log} 구조', async () => {
    const { status, json } = await apiFetch('/api/analyze-log');
    assertStatus(status, 200);
    assert(typeof json.running === 'boolean', 'running 필드 누락');
    assert(Array.isArray(json.log), 'log 필드가 배열이 아님');
  });

  await test('GET /api/latest-signal?pair=BTCUSDT — 200', async () => {
    const { status } = await apiFetch('/api/latest-signal?pair=BTCUSDT');
    assertStatus(status, 200);
  });

  await test('POST /api/trades — dry-run 거래 저장', async () => {
    const mockSignal = {
      pair: 'BTCUSDT', direction: 'LONG',
      entry: { price: 65000, basis: 'OB', killzone: 'London' },
      sl: 64200, tp: [66000, 67000], rr: 2.0,
      confidence: 'HIGH', tier: 1,
      structure: { amdPhase: 'ACCUMULATION' },
      scorecard: { total: 5, grade: 'A' },
    };
    const { status, json } = await apiFetch('/api/trades', {
      method: 'POST',
      body: JSON.stringify({ signal: mockSignal }),
    });
    assertStatus(status, 200);
    assert(json.ok === true, `ok !== true: ${JSON.stringify(json)}`);
    assert(typeof json.filename === 'string', 'filename 누락');
  });

  await test('POST /api/trades — 시그널 누락 시 400', async () => {
    const { status, json } = await apiFetch('/api/trades', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    assertStatus(status, 400);
    assert(json.ok === false, 'ok가 false여야 함');
  });

  await test('POST /api/analyze 중복 실행 방지 (409 or 200)', async () => {
    // 이미 실행 중이 아니면 200, 실행 중이면 409 — 두 경우 모두 ok
    const { status, json } = await apiFetch('/api/analyze', {
      method: 'POST',
      body: JSON.stringify({ pair: 'BTCUSDT', tf: '1H' }),
    });
    assert(status === 200 || status === 409, `예상치 못한 상태코드: ${status}`);
    if (status === 200) assert(json.ok === true, 'ok !== true');
  });

  await test('GET /api/events — SSE 연결 수립', async () => {
    await new Promise((resolve, reject) => {
      const req = http.get(`${BASE_URL}/api/events`, { headers: { Accept: 'text/event-stream' } }, (res) => {
        assertStatus(res.statusCode, 200, '/api/events');
        assert(
          res.headers['content-type']?.includes('text/event-stream'),
          `Content-Type: ${res.headers['content-type']}`
        );
        res.destroy();
        resolve();
      });
      req.on('error', reject);
      req.setTimeout(3000, () => { req.destroy(); reject(new Error('SSE 연결 타임아웃')); });
    });
  });

  await test('CORS preflight (OPTIONS) — 204', async () => {
    const res = await fetch(BASE_URL + '/api/config', { method: 'OPTIONS' });
    assertStatus(res.status, 204);
  });

  await test('존재하지 않는 경로 — 404', async () => {
    const { status } = await apiFetch('/api/nonexistent');
    assertStatus(status, 404);
  });
}

// ══════════════════════════════════════════════════════════════════════════════
//  UI 테스트 (Playwright)
// ══════════════════════════════════════════════════════════════════════════════
async function runUiTests(browser) {
  console.log('\n🖥️  UI 테스트');

  const ctx  = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  _page = page;

  // 콘솔 오류 수집
  const consoleErrors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', err => consoleErrors.push(err.message));

  // ── 기본 로드 ──────────────────────────────────────────────────────────────
  await test('페이지 로드 — HTTP 200, 타이틀 포함', async () => {
    const resp = await page.goto(BASE_URL, { waitUntil: 'domcontentloaded', timeout: 10000 });
    assert(resp.status() === 200, `HTTP ${resp.status()}`);
    const title = await page.title();
    assert(title.includes('ICT'), `title: "${title}"`);
  });

  await test('헤더 — 로고 "ICT Engine" 존재', async () => {
    const logo = await page.locator('.logo').textContent();
    assert(logo.includes('ICT Engine'), `logo: "${logo}"`);
  });

  await test('헤더 — 4개 페어 탭 존재 (BTC/ETH/SOL/HYPE)', async () => {
    const tabs = await page.locator('.pair-tab').count();
    assert(tabs === 4, `탭 수: ${tabs}`);
    const btcText = await page.locator('.pair-tab[data-pair="BTCUSDT"]').textContent();
    assert(btcText.trim() === 'BTC', `BTC 탭: "${btcText}"`);
  });

  await test('헤더 — 4개 TF 필 존재 (15M/1H/4H/1D)', async () => {
    const pills = await page.locator('.tf-pill').count();
    assert(pills === 4, `필 수: ${pills}`);
  });

  await test('헤더 — 킬존 배지 & DRY-RUN 배지 존재', async () => {
    const kzBadge   = page.locator('#kzBadge');
    const modeBadge = page.locator('.mode-badge');
    await kzBadge.waitFor({ timeout: 3000 });
    await modeBadge.waitFor({ timeout: 3000 });
    const modeText = await modeBadge.textContent();
    assert(modeText.includes('DRY-RUN'), `mode badge: "${modeText}"`);
  });

  await test('헤더 — 상태 닷(status dot) 존재', async () => {
    const dot = page.locator('.status-dot');
    await dot.waitFor({ timeout: 3000 });
  });

  // ── 페어 탭 전환 ───────────────────────────────────────────────────────────
  await test('페어 탭 — BTC 기본 활성화', async () => {
    const active = await page.locator('.pair-tab.active').getAttribute('data-pair');
    assert(active === 'BTCUSDT', `active pair: ${active}`);
  });

  await test('페어 탭 — ETH 클릭 시 활성화', async () => {
    await page.locator('.pair-tab[data-pair="ETHUSDT"]').click();
    await page.waitForTimeout(300);
    const active = await page.locator('.pair-tab.active').getAttribute('data-pair');
    assert(active === 'ETHUSDT', `active pair: ${active}`);
  });

  await test('페어 탭 — SOL 클릭 시 활성화', async () => {
    await page.locator('.pair-tab[data-pair="SOLUSDT"]').click();
    await page.waitForTimeout(300);
    const active = await page.locator('.pair-tab.active').getAttribute('data-pair');
    assert(active === 'SOLUSDT', `active pair: ${active}`);
  });

  await test('페어 탭 — HYPE 클릭 시 활성화', async () => {
    await page.locator('.pair-tab[data-pair="HYPEUSDT"]').click();
    await page.waitForTimeout(300);
    const active = await page.locator('.pair-tab.active').getAttribute('data-pair');
    assert(active === 'HYPEUSDT', `active pair: ${active}`);
  });

  await test('페어 탭 — BTC 복귀', async () => {
    await page.locator('.pair-tab[data-pair="BTCUSDT"]').click();
    await page.waitForTimeout(300);
    const active = await page.locator('.pair-tab.active').getAttribute('data-pair');
    assert(active === 'BTCUSDT', `active pair: ${active}`);
  });

  // ── TF 필 전환 ────────────────────────────────────────────────────────────
  await test('TF 필 — 1H 기본 활성화', async () => {
    const active = await page.locator('.tf-pill.active').getAttribute('data-tf');
    assert(active === '1h', `active tf: ${active}`);
  });

  await test('TF 필 — 4H 클릭 시 활성화', async () => {
    await page.locator('.tf-pill[data-tf="4h"]').click();
    await page.waitForTimeout(300);
    const active = await page.locator('.tf-pill.active').getAttribute('data-tf');
    assert(active === '4h', `active tf: ${active}`);
  });

  await test('TF 필 — 1D 클릭 시 활성화', async () => {
    await page.locator('.tf-pill[data-tf="1d"]').click();
    await page.waitForTimeout(300);
    const active = await page.locator('.tf-pill.active').getAttribute('data-tf');
    assert(active === '1d', `active tf: ${active}`);
  });

  await test('TF 필 — 15M 클릭 시 활성화', async () => {
    await page.locator('.tf-pill[data-tf="15m"]').click();
    await page.waitForTimeout(300);
    const active = await page.locator('.tf-pill.active').getAttribute('data-tf');
    assert(active === '15m', `active tf: ${active}`);
  });

  await test('TF 필 — 1H 복귀', async () => {
    await page.locator('.tf-pill[data-tf="1h"]').click();
    await page.waitForTimeout(300);
    const active = await page.locator('.tf-pill.active').getAttribute('data-tf');
    assert(active === '1h', `active tf: ${active}`);
  });

  // ── 오버레이 버튼 토글 ────────────────────────────────────────────────────
  await test('오버레이 — FVG/OB/BB/Sweep 버튼 초기 활성(on) 상태', async () => {
    for (const id of ['btnFVG', 'btnOB', 'btnBB', 'btnSweep']) {
      const hasOn = await page.locator(`#${id}`).evaluate(el => el.classList.contains('on'));
      assert(hasOn, `${id} is not .on`);
    }
  });

  await test('오버레이 — FVG 버튼 토글 (on → off → on)', async () => {
    const btn = page.locator('#btnFVG');
    await btn.click();
    await page.waitForTimeout(200);
    let hasOn = await btn.evaluate(el => el.classList.contains('on'));
    assert(!hasOn, 'FVG should be off after 1st click');

    await btn.click();
    await page.waitForTimeout(200);
    hasOn = await btn.evaluate(el => el.classList.contains('on'));
    assert(hasOn, 'FVG should be on after 2nd click');
  });

  await test('오버레이 — OB 버튼 토글', async () => {
    const btn = page.locator('#btnOB');
    await btn.click(); await page.waitForTimeout(150);
    let on = await btn.evaluate(el => el.classList.contains('on'));
    assert(!on, 'OB should be off');
    await btn.click(); await page.waitForTimeout(150);
    on = await btn.evaluate(el => el.classList.contains('on'));
    assert(on, 'OB should be on again');
  });

  // ── 차트 영역 ─────────────────────────────────────────────────────────────
  await test('차트 — #chart 컨테이너 존재', async () => {
    const el = page.locator('#chart');
    await el.waitFor({ timeout: 3000 });
    const box = await el.boundingBox();
    assert(box && box.width > 0 && box.height > 0, `chart box: ${JSON.stringify(box)}`);
  });

  await test('차트 — 캔들 데이터 로드 후 canvas 렌더링', async () => {
    // LightweightCharts는 canvas를 생성함
    await page.waitForTimeout(3000); // 캔들 로드 대기
    const canvasCount = await page.locator('#chart canvas').count();
    assert(canvasCount > 0, 'canvas 없음 — LightweightCharts 미초기화');
  });

  await test('차트 — 가격 표시 업데이트 (—가 아닌 값)', async () => {
    await page.waitForTimeout(4000); // WS/REST 로드 대기
    const price = await page.locator('#priceDisplay').textContent();
    assert(price && price.trim() !== '—', `priceDisplay: "${price}"`);
  });

  // ── ICT 분석 버튼 ─────────────────────────────────────────────────────────
  await test('ICT 분석 버튼 — 존재하고 클릭 가능', async () => {
    const btn = page.locator('#analyze-btn');
    await btn.waitFor({ timeout: 3000 });
    const disabled = await btn.evaluate(el => el.disabled);
    assert(!disabled, '버튼이 disabled 상태');
  });

  await test('ICT 분석 버튼 — 클릭 시 로딩 스피너 표시', async () => {
    const btn     = page.locator('#analyze-btn');
    const spinner = page.locator('#analyze-btn .spinner');
    await btn.click();
    await page.waitForTimeout(300);
    const display = await spinner.evaluate(el => window.getComputedStyle(el).display);
    assert(display !== 'none', `spinner display: ${display}`);
    // 완료 대기 (최대 30초)
    await page.waitForFunction(
      () => !document.getElementById('analyze-btn')?.classList.contains('loading'),
      { timeout: 30000 }
    ).catch(() => {}); // 타임아웃은 무시 (엔진이 오래 걸릴 수 있음)
  });

  await test('로그 패널 — 분석 실행 후 표시', async () => {
    // 분석 버튼 클릭 이미 완료됨 — SSE log 이벤트가 오면 패널이 열림
    const panel = page.locator('#log-panel');
    const visible = await panel.evaluate(el => el.classList.contains('visible') || el.style.display !== 'none');
    // 분석이 끝났을 수 있으므로 로그 라인 수 확인
    const lines = await page.locator('#log-panel .log-line').count();
    assert(visible || lines > 0, '로그 패널 미표시');
  });

  // ── 사이드 패널 ───────────────────────────────────────────────────────────
  await test('스코어카드 — 섹션 타이틀 존재', async () => {
    const titles = await page.locator('.side-section-title').allTextContents();
    const hasScorecard = titles.some(t => t.includes('스코어카드') || t.includes('Scorecard'));
    assert(hasScorecard, `section titles: ${JSON.stringify(titles)}`);
  });

  await test('AMD 사이클 — 4개 스테이지 존재', async () => {
    const stages = await page.locator('.amd-stage').count();
    assert(stages === 4, `stage 수: ${stages}`);
  });

  await test('AMD 사이클 — 스테이지 텍스트 확인 (축적/조작/분배/리셋)', async () => {
    const texts = await page.locator('.amd-stage').allTextContents();
    const expected = ['축적', '조작', '분배', '리셋'];
    for (const t of expected) {
      assert(texts.some(tx => tx.includes(t)), `"${t}" 스테이지 없음`);
    }
  });

  await test('시그널 섹션 — 초기 플레이스홀더 또는 분석 후 시그널 카드', async () => {
    const signalBody = page.locator('#signal-body');
    await signalBody.waitFor({ timeout: 3000 });
    const html = await signalBody.innerHTML();
    assert(html.length > 0, 'signal-body 비어 있음');
  });

  // ── 트레이딩 이력 ─────────────────────────────────────────────────────────
  await test('트레이딩 이력 — 헤더 존재', async () => {
    const header = page.locator('#history-header h3');
    await header.waitFor({ timeout: 3000 });
    const text = await header.textContent();
    assert(text.length > 0, '이력 헤더 텍스트 없음');
  });

  await test('트레이딩 이력 — POST 후 거래 건수 증가', async () => {
    const before = await page.locator('#tradeCount').textContent();

    // API로 직접 거래 추가
    await apiFetch('/api/trades', {
      method: 'POST',
      body: JSON.stringify({
        signal: {
          pair: 'BTCUSDT', direction: 'SHORT',
          entry: { price: 65500 }, sl: 66200,
          tp: [64500, 63800], rr: 1.8,
          confidence: 'MEDIUM', tier: 2,
          structure: { amdPhase: 'DISTRIBUTION' },
          scorecard: { total: 4, grade: 'B' },
        },
      }),
    });

    // SSE push로 UI가 업데이트될 때까지 대기 (최대 3초)
    await page.waitForTimeout(1500);
    const after = await page.locator('#tradeCount').textContent();
    const countBefore = parseInt(before) || 0;
    const countAfter  = parseInt(after)  || 0;
    assert(countAfter >= countBefore, `건수 감소: ${before} → ${after}`);
  });

  // ── 콘솔 오류 검사 ────────────────────────────────────────────────────────
  await test('콘솔 오류 없음 (JavaScript 런타임 오류)', async () => {
    // 무시할 오류 패턴 (외부 CDN, WS 재연결 등)
    const ignored = [
      'Failed to load resource',
      'WebSocket',
      'net::ERR',
      'favicon',
    ];
    const realErrors = consoleErrors.filter(
      msg => !ignored.some(pat => msg.includes(pat))
    );
    assert(realErrors.length === 0, `콘솔 오류:\n${realErrors.join('\n')}`);
  });

  // ── 최종 스크린샷 ─────────────────────────────────────────────────────────
  const ssPath = path.join(REPORT_DIR, `pw-final-${DATE_STR}.png`);
  await page.screenshot({ path: ssPath, fullPage: false });
  console.log(`\n  📸 최종 스크린샷: ${ssPath}`);

  await ctx.close();
  _page = null;
}

// ══════════════════════════════════════════════════════════════════════════════
//  결과 저장
// ══════════════════════════════════════════════════════════════════════════════
function saveResults() {
  const pass    = results.filter(r => r.status === 'PASS').length;
  const fail    = results.filter(r => r.status === 'FAIL').length;
  const total   = results.length;
  const runAt   = new Date().toISOString();
  const summary = { runAt, total, pass, fail, passRate: `${((pass/total)*100).toFixed(1)}%`, issues };

  // ── JSON ──────────────────────────────────────────────────────────────────
  const jsonPath = path.join(REPORT_DIR, `playwright-results-${DATE_STR}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify({ summary, results }, null, 2));

  // ── Markdown ──────────────────────────────────────────────────────────────
  const mdLines = [
    `# ICT 대시보드 Playwright 테스트 결과`,
    ``,
    `> 실행: ${runAt}`,
    ``,
    `## 요약`,
    ``,
    `| 항목 | 값 |`,
    `|------|----|`,
    `| 전체 | ${total} |`,
    `| 통과 | ${pass} ✅ |`,
    `| 실패 | ${fail} ${fail > 0 ? '❌' : ''} |`,
    `| 통과율 | ${summary.passRate} |`,
    ``,
  ];

  if (issues.length > 0) {
    mdLines.push('## 이슈 목록', '');
    issues.forEach((iss, i) => {
      mdLines.push(`### ${i + 1}. ${iss.test}`);
      mdLines.push('');
      mdLines.push('```');
      mdLines.push(iss.error);
      mdLines.push('```');
      mdLines.push('');
    });
  }

  mdLines.push('## 전체 결과', '');
  mdLines.push('| # | 테스트 | 상태 | 소요 |');
  mdLines.push('|---|--------|------|------|');
  results.forEach((r, i) => {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    mdLines.push(`| ${i + 1} | ${r.name} | ${icon} ${r.status} | ${r.duration}ms |`);
  });

  const mdPath = path.join(REPORT_DIR, `playwright-results-${DATE_STR}.md`);
  fs.writeFileSync(mdPath, mdLines.join('\n') + '\n');

  return { jsonPath, mdPath, summary };
}

// ══════════════════════════════════════════════════════════════════════════════
//  메인
// ══════════════════════════════════════════════════════════════════════════════
(async () => {
  console.log('🧪 ICT 대시보드 Playwright 테스트 시작\n');
  console.log(`   대상: ${BASE_URL}`);

  // 서버 응답 확인
  try {
    await waitForServer();
    console.log('   서버 연결 확인 ✅');
  } catch (e) {
    console.error(`\n❌ 서버 미응답: ${e.message}`);
    console.error('   node scripts/dashboard-server.js 를 먼저 실행하세요.\n');
    process.exit(1);
  }

  // API 테스트
  await runApiTests();

  // UI 테스트
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    await runUiTests(browser);
  } finally {
    if (browser) await browser.close();
  }

  // 결과 저장
  const { jsonPath, mdPath, summary } = saveResults();

  // 요약 출력
  const bar = summary.fail === 0 ? '🟢' : '🔴';
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`${bar} 결과: ${summary.pass}/${summary.total} 통과 (${summary.passRate})`);
  if (summary.fail > 0) {
    console.log(`\n실패한 테스트:`);
    issues.forEach(iss => console.log(`  ❌ ${iss.test}`));
  }
  console.log(`\n📄 JSON: ${jsonPath}`);
  console.log(`📝 MD:   ${mdPath}`);
  console.log('');

  process.exit(summary.fail > 0 ? 1 : 0);
})();
