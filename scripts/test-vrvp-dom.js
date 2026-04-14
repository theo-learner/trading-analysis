/**
 * test-vrvp-dom.js — VRVP POC/VAH/VAL WebSocket 인터셉트 테스트
 *
 * 전략:
 *   TradingView는 VRVP 값을 WebSocket `du` 메시지로 전달한다.
 *   메시지 구조: {"m":"du","p":[session, {studyKey: {ns: {d: JSON}}}]}
 *   JSON 내 graphicsCmds.create.horizlines 배열에 pocLines/vahLines/valLines 있음.
 *   단, 첫 번째 du 메시지는 data[]가 비어있고 이후 업데이트에서 실제 가격 도착.
 *   → data.length > 0 인 메시지가 올 때까지 기다리는 것이 핵심.
 *
 * 사용법: node scripts/test-vrvp-dom.js
 */

const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const SESSION_DIR = path.join(__dirname, '..', 'sessions');
const CLEAN_LAYOUT_PATH = path.join(__dirname, 'config', 'clean-layout.json');

function loadCleanLayoutId() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CLEAN_LAYOUT_PATH, 'utf-8'));
    return cfg.layoutId || null;
  } catch { return null; }
}

/**
 * WebSocket 프레임에서 VRVP horizlines 데이터 파싱 시도
 * pocLines/vahLines/valLines 중 하나라도 data.length > 0 이면 반환
 */
function parseVrvpFromFrame(rawData) {
  if (!rawData.includes('pocLines') && !rawData.includes('vahLines') && !rawData.includes('valLines')) {
    return null;
  }

  // TradingView WebSocket 프레임: ~m~{len}~m~{json} 형태로 여러 메시지 연결될 수 있음
  const jsonMatches = rawData.match(/\{[^{}]*"m"\s*:\s*"du"[^]*?\}(?=~m~|$)/g) || [];
  // 더 단순한 방법: 모든 { 시작 JSON 파싱 시도
  const segments = rawData.split('~m~').filter(s => s.startsWith('{'));

  for (const seg of segments) {
    try {
      const msg = JSON.parse(seg);
      if (msg.m !== 'du' || !Array.isArray(msg.p) || msg.p.length < 2) continue;

      const studyData = msg.p[1];
      if (typeof studyData !== 'object') continue;

      for (const [studyKey, studyVal] of Object.entries(studyData)) {
        const nsD = studyVal?.ns?.d;
        if (typeof nsD !== 'string') continue;

        let inner;
        try { inner = JSON.parse(nsD); } catch { continue; }

        const horizlines = inner?.graphicsCmds?.create?.horizlines;
        if (!Array.isArray(horizlines)) continue;

        const result = {};
        for (const hl of horizlines) {
          if (!hl.styleId || !Array.isArray(hl.data)) continue;
          if (hl.data.length === 0) continue;

          const styleId = hl.styleId;
          // data 구조: 각 요소가 가격 레벨. 숫자 or {price: ...} or 배열 등 형태 확인
          const firstItem = hl.data[0];
          let price = null;

          if (typeof firstItem === 'number') {
            price = firstItem;
          } else if (typeof firstItem === 'object') {
            // 가능한 필드: price, value, y, level
            price = firstItem.price ?? firstItem.value ?? firstItem.y ?? firstItem.level ?? null;
            // data[0]이 배열인 경우 (예: [price, color, width])
            if (price === null && Array.isArray(firstItem)) {
              price = typeof firstItem[0] === 'number' ? firstItem[0] : null;
            }
          }

          if (price !== null && !isNaN(price)) {
            if (styleId === 'pocLines') result.poc = price;
            else if (styleId === 'vahLines') result.vah = price;
            else if (styleId === 'valLines') result.val = price;
          }

          // data 샘플 저장 (디버깅)
          result[`_${styleId}_sample`] = JSON.stringify(firstItem).slice(0, 200);
        }

        if (Object.keys(result).some(k => !k.startsWith('_'))) {
          result._studyKey = studyKey;
          return result;
        }

        // data는 있지만 price 파싱 실패 → 샘플 반환 (디버깅용)
        if (Object.keys(result).some(k => k.startsWith('_'))) {
          result._studyKey = studyKey;
          result._parseError = true;
          return result;
        }
      }
    } catch { /* 다음 세그먼트 시도 */ }
  }
  return null;
}

(async () => {
  const CLEAN_LAYOUT_ID = loadCleanLayoutId();
  const sessionPath = path.join(SESSION_DIR, 'tv-session.json');
  if (!fs.existsSync(sessionPath)) {
    console.error('❌ sessions/tv-session.json 없음');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 2,
    storageState: sessionPath,
  });
  const page = await context.newPage();

  // WebSocket 리스너를 페이지 이동 전에 등록
  const vrvpPromise = new Promise((resolve) => {
    const allMessages = [];
    let resolved = false;

    page.on('websocket', ws => {
      console.log(`  [WS] 연결: ${ws.url().slice(0, 80)}`);

      ws.on('framereceived', event => {
        if (resolved) return;
        const data = typeof event.payload === 'string' ? event.payload : '';
        if (!data.includes('pocLines') && !data.includes('vahLines') && !data.includes('valLines')) return;

        const result = parseVrvpFromFrame(data);
        if (!result) return;

        // _parseError: 구조는 찾았지만 price 파싱 실패 → 디버깅용으로 로그만
        if (result._parseError) {
          console.log(`  [WS] VRVP 구조 발견 (study=${result._studyKey}) — price 파싱 실패, 샘플:`);
          Object.entries(result).filter(([k]) => k.startsWith('_')).forEach(([k, v]) => {
            console.log(`    ${k}: ${v}`);
          });
          allMessages.push({ type: 'parseError', result, raw: data.slice(0, 500) });
          return;
        }

        // 성공
        console.log(`  [WS] VRVP 데이터 수신! study=${result._studyKey}`);
        resolved = true;
        resolve({ ok: true, vrvp: result, allMessages });
      });

      ws.on('close', () => {
        console.log(`  [WS] 닫힘`);
      });
    });

    // 타임아웃: 30초
    setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve({ ok: false, reason: 'timeout', allMessages });
      }
    }, 30000);
  });

  const url = CLEAN_LAYOUT_ID
    ? `https://www.tradingview.com/chart/${CLEAN_LAYOUT_ID}/?symbol=BINANCE:BTCUSDT.P&interval=1D`
    : `https://www.tradingview.com/chart/?symbol=BINANCE:BTCUSDT.P&interval=1D`;

  console.log(`\n🌐 ${url}`);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });

  console.log('⏳ 차트 로드 + WebSocket 데이터 대기 (최대 30초)...');
  await page.waitForSelector('.chart-container', { timeout: 20000 }).catch(() => {});

  const wsResult = await vrvpPromise;

  if (!wsResult.ok) {
    console.log(`\n❌ VRVP 데이터 수신 실패: ${wsResult.reason}`);
    console.log(`   수신된 VRVP 관련 메시지 수: ${wsResult.allMessages.length}`);
    wsResult.allMessages.slice(0, 3).forEach((m, i) => {
      console.log(`\n   [메시지 ${i}] type=${m.type}`);
      console.log(`   raw: ${m.raw}`);
    });

    // 디버깅: 페이지에서 직접 WS 메시지 덤프 시도
    console.log('\n📋 추가 디버깅: 전체 WS 메시지 목록에서 pocLines 검색...');
    await browser.close();
    return;
  }

  const { vrvp } = wsResult;
  console.log('\n=== VRVP 추출 결과 ===');
  if (vrvp.poc !== undefined) console.log(`  POC: ${vrvp.poc.toLocaleString()}`);
  if (vrvp.vah !== undefined) console.log(`  VAH: ${vrvp.vah.toLocaleString()}`);
  if (vrvp.val !== undefined) console.log(`  VAL: ${vrvp.val.toLocaleString()}`);
  console.log(`  study: ${vrvp._studyKey}`);

  // _sample 필드 출력
  ['pocLines', 'vahLines', 'valLines'].forEach(k => {
    const sample = vrvp[`_${k}_sample`];
    if (sample) console.log(`  ${k} data[0] sample: ${sample}`);
  });

  // 3개 다 있으면 성공
  const hasAll = vrvp.poc !== undefined && vrvp.vah !== undefined && vrvp.val !== undefined;
  if (hasAll) {
    console.log('\n✅ POC/VAH/VAL 모두 추출 성공!');
    console.log(JSON.stringify({ poc: vrvp.poc, vah: vrvp.vah, val: vrvp.val }, null, 2));
  } else {
    const missing = ['poc', 'vah', 'val'].filter(k => vrvp[k] === undefined);
    console.log(`\n⚠️  일부 누락: ${missing.join(', ')}`);
  }

  await browser.close();
})();
