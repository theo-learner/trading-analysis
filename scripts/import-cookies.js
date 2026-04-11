/**
 * import-cookies.js — DevTools Cookie + LocalStorage → Playwright storageState 변환
 *
 * 사용법:
 *   1. Chrome DevTools → Application → Cookies → 도메인 선택 → Ctrl+A → Ctrl+C
 *   2. npm run import-cookies:<platform>  (실행 후 붙여넣고 Ctrl+D)
 *   3. LocalStorage 입력 프롬프트가 나오면:
 *      DevTools 콘솔에서 실행: JSON.stringify(Object.entries(localStorage))
 *      결과 붙여넣고 Ctrl+D (필요 없으면 그냥 Ctrl+D로 건너뜀)
 *
 * 지원 플랫폼: tradingview, coinglass, coinalyze, hyblock
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

const PLATFORMS = {
  tradingview: { sessionFile: 'tv-session.json',        domain: '.tradingview.com' },
  coinglass:   { sessionFile: 'coinglass-session.json', domain: '.coinglass.com' },
  coinalyze:   { sessionFile: 'coinalyze-session.json', domain: '.coinalyze.net' },
  hyblock:     { sessionFile: 'hyblock-session.json',   domain: '.hyblockcapital.com' },
};

const SAME_SITE_MAP = { lax: 'Lax', strict: 'Strict', none: 'None', 'no_restriction': 'None' };

// Network 탭 Cookie 헤더 형식: "name=value; name2=value2"
function parseCookieHeader(str, domain) {
  return str.split(';').map((s) => s.trim()).filter(Boolean).map((pair) => {
    const idx = pair.indexOf('=');
    if (idx === -1) return null;
    return { name: pair.slice(0, idx).trim(), value: pair.slice(idx + 1).trim(),
      domain, path: '/', expires: -1, httpOnly: false, secure: true, sameSite: 'None' };
  }).filter(Boolean);
}

// Application 탭 전체선택 복사 TSV 형식
// 컬럼: Name\tValue\tDomain\tPath\tExpires\tSize\tHttpOnly\tSecure\tSameSite\t...
function parseTSV(str) {
  const CHECKMARKS = ['✓', '✔', '☑', '\u2713', '\u2714'];
  const isCheck = (v) => CHECKMARKS.includes(v?.trim()) || v?.trim() === 'true';

  return str.split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
    const cols = line.split('\t');
    if (cols.length < 4) return null;
    const [name, value, domain, cookiePath, expires, , httpOnly, secure, sameSite] = cols;
    if (!name || !value) return null;
    const exp = expires ? Date.parse(expires) / 1000 : -1;
    return {
      name: name.trim(),
      value: value.trim(),
      domain: domain.trim(),
      path: cookiePath?.trim() || '/',
      expires: isNaN(exp) ? -1 : exp,
      httpOnly: isCheck(httpOnly),
      secure: isCheck(secure),
      sameSite: SAME_SITE_MAP[sameSite?.trim()?.toLowerCase()] ?? 'None',
    };
  }).filter(Boolean);
}

function parse(str, domain) {
  const isTSV = str.includes('\t');
  const cookies = isTSV ? parseTSV(str) : parseCookieHeader(str, domain);
  return cookies;
}

async function readStdin() {
  const rl = readline.createInterface({ input: process.stdin });
  const lines = [];
  for await (const line of rl) lines.push(line);
  return lines.join('\n').trim();
}

/**
 * stdin 전체를 읽어 '---' 구분자로 쿠키/localStorage 두 섹션으로 분리.
 * 구분자 없으면 [전체, ''] 반환.
 */
function splitSections(raw) {
  const SEP = /^---\s*$/m;
  const idx = raw.search(SEP);
  if (idx === -1) return [raw.trim(), ''];
  const cookiePart = raw.slice(0, idx).trim();
  const lsPart = raw.slice(idx).replace(SEP, '').trim();
  return [cookiePart, lsPart];
}

(async () => {
  const platform = process.argv[2];

  if (!platform || !PLATFORMS[platform]) {
    console.error('사용법: node scripts/import-cookies.js <platform>');
    console.error(`플랫폼: ${Object.keys(PLATFORMS).join(', ')}`);
    process.exit(1);
  }

  const { sessionFile, domain } = PLATFORMS[platform];

  console.log('─────────────────────────────────────────────────────');
  console.log('1단계: DevTools → Application → Cookies → 도메인 선택 → Ctrl+A → Ctrl+C');
  console.log('       (Network 탭 Cookie 헤더 값도 지원)');
  console.log('');
  console.log('LocalStorage도 포함하려면 (Coinglass 등 JWT 인증):');
  console.log('  쿠키 붙여넣기 후 새 줄에 --- 입력 후 Enter,');
  console.log('  이어서 DevTools 콘솔에서 실행한 결과 붙여넣기:');
  console.log('  JSON.stringify(Object.entries(localStorage))');
  console.log('');
  console.log('준비 완료 후 Ctrl+D:');
  console.log('─────────────────────────────────────────────────────');

  const raw = await readStdin();

  if (!raw) {
    console.error('❌ 입력이 비어있습니다.');
    process.exit(1);
  }

  const [cookieStr, lsStr] = splitSections(raw);

  if (!cookieStr) {
    console.error('❌ 쿠키 입력이 비어있습니다.');
    process.exit(1);
  }

  const cookies = parse(cookieStr, domain);

  // origins: localStorage 포함 여부
  let origins = [];
  if (lsStr) {
    try {
      const entries = JSON.parse(lsStr);
      if (!Array.isArray(entries)) throw new Error('배열 형식이 아닙니다');
      const origin = `https://${domain.replace(/^\./, 'www.')}`;
      origins = [{
        origin,
        localStorage: entries.map(([name, value]) => ({ name, value: String(value) })),
      }];
      console.log(`   LocalStorage 항목: ${entries.length}개 (origin: ${origin})`);
    } catch (e) {
      console.error(`⚠️  LocalStorage 파싱 실패 (쿠키만 저장): ${e.message}`);
    }
  }

  const storageState = { cookies, origins };
  const outPath = path.join(__dirname, '..', 'sessions', sessionFile);
  fs.writeFileSync(outPath, JSON.stringify(storageState, null, 2));

  console.log(`✅ ${platform} 세션 저장 완료: ${sessionFile}`);
  console.log(`   쿠키 수: ${cookies.length}개`);
  console.log(`   저장 위치: ${outPath}`);
})();
