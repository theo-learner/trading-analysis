/**
 * save-session.js — 플랫폼별 로그인 세션 저장 스크립트
 *
 * 사용법: node scripts/save-session.js [platform]
 *
 * 지원 플랫폼:
 *   tradingview  — TradingView 로그인 세션
 *   coinglass    — Coinglass 로그인 세션 (Pro 기능 포함)
 *   coinalyze    — Coinalyze 로그인 세션
 *   hyblock      — Hyblock Capital 로그인 세션
 *   all          — 모든 플랫폼 순차 저장
 */

const { chromium } = require('playwright');
const path = require('path');
const os = require('os');
const readline = require('readline');

const CHROME_USER_DATA_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'Google', 'Chrome');

const PLATFORMS = {
  tradingview: {
    name: 'TradingView',
    url: 'https://www.tradingview.com/#signin',
    sessionFile: 'tv-session.json',
  },
  coinglass: {
    name: 'Coinglass',
    url: 'https://www.coinglass.com/pro/futures/LiquidationMap',
    sessionFile: 'coinglass-session.json',
  },
  coinalyze: {
    name: 'Coinalyze',
    url: 'https://coinalyze.net/login',
    sessionFile: 'coinalyze-session.json',
  },
  hyblock: {
    name: 'Hyblock Capital',
    url: 'https://www.hyblockcapital.com/login',
    sessionFile: 'hyblock-session.json',
  },
};

function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function saveSession(platformKey) {
  const platform = PLATFORMS[platformKey];
  if (!platform) {
    console.error(`❌ 알 수 없는 플랫폼: ${platformKey}`);
    console.log(`지원 플랫폼: ${Object.keys(PLATFORMS).join(', ')}`);
    process.exit(1);
  }

  const sessionPath = path.join(__dirname, '..', 'sessions', platform.sessionFile);

  console.log(`\n🌐 ${platform.name} 세션 저장 시작...`);
  console.log(`📂 저장 경로: ${sessionPath}\n`);

  // 기존 Chrome 프로필을 그대로 사용 — 이미 로그인된 쿠키/세션 공유
  // 주의: Chrome이 실행 중이면 프로필 잠금 충돌이 발생하므로 먼저 종료 필요
  console.log('⚠️  Chrome이 실행 중이라면 지금 종료해주세요.');
  console.log('   (종료 후 Enter를 누르면 Chrome이 자동으로 열립니다)\n');
  await prompt('   ▶ Chrome 종료 후 Enter: ');

  const context = await chromium.launchPersistentContext(CHROME_USER_DATA_DIR, {
    channel: 'chrome',
    headless: false,
    args: ['--window-size=1440,900'],
    viewport: { width: 1440, height: 900 },
  });

  const page = context.pages()[0] ?? await context.newPage();
  await page.goto(platform.url, { waitUntil: 'domcontentloaded' });

  console.log(`\n✅ 기존 Chrome 세션으로 ${platform.name} 열림`);
  console.log('   로그인이 안 돼 있다면 지금 로그인하세요.');
  console.log('   준비되면 Enter를 누르세요...\n');

  await prompt('   ▶ Enter 입력: ');

  // 페이지 안정화 대기
  await page.waitForTimeout(2000);

  await context.storageState({ path: sessionPath });
  await context.close();

  console.log(`✅ ${platform.name} 세션 저장 완료: ${platform.sessionFile}\n`);
}

(async () => {
  const target = process.argv[2] || 'all';

  if (target === 'all') {
    console.log('=== 모든 플랫폼 세션 순차 저장 ===\n');
    for (const key of Object.keys(PLATFORMS)) {
      await saveSession(key);
    }
    console.log('🎉 모든 플랫폼 세션 저장 완료!');
  } else {
    await saveSession(target);
  }
})();
