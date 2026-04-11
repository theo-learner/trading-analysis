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
 *
 * Chrome을 종료하지 않아도 됩니다.
 * 이미 열린 Chrome 창에서 해당 사이트에 로그인된 상태이면 자동으로 세션을 추출합니다.
 */

const readline = require('readline');
const { grabSession, cleanup, PLATFORMS } = require('./grab-session');

// 플랫폼별 확인용 URL (로그인 여부를 브라우저에서 직접 확인하도록 안내)
const PLATFORM_URLS = {
  tradingview: 'https://www.tradingview.com',
  coinglass: 'https://www.coinglass.com/pro/futures/LiquidationMap',
  coinalyze: 'https://coinalyze.net',
  hyblock: 'https://www.hyblockcapital.com',
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

  const url = PLATFORM_URLS[platformKey] || '';

  console.log(`\n🌐 ${platform.name} 세션 저장`);
  if (url) console.log(`   URL: ${url}`);
  console.log('   Chrome에서 위 사이트에 로그인되어 있는지 확인 후 Enter를 누르세요.\n');

  await prompt('   ▶ Enter: ');

  const success = grabSession(platformKey);
  if (!success) {
    console.error(`❌ ${platform.name} 세션 저장 실패 — Chrome에서 로그인 후 다시 시도하세요.`);
  }
}

(async () => {
  const target = process.argv[2] || 'all';

  try {
    if (target === 'all') {
      console.log('=== 모든 플랫폼 세션 순차 저장 ===\n');
      for (const key of Object.keys(PLATFORMS)) {
        await saveSession(key);
      }
      console.log('\n🎉 모든 플랫폼 세션 저장 완료!');
    } else {
      await saveSession(target);
    }
  } finally {
    cleanup();
  }
})();
