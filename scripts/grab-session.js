/**
 * grab-session.js — 실행 중인 Chrome에서 세션 추출
 *
 * 사용법: node scripts/grab-session.js [platform]
 *
 * 지원 플랫폼:
 *   coinglass   — Coinglass Pro 세션 (Google 로그인 쿠키 포함)
 *   coinalyze   — Coinalyze 세션
 *   hyblock     — Hyblock Capital 세션
 *   tradingview — TradingView 세션
 *   all         — 모든 플랫폼 순차 추출
 *
 * 동작 원리:
 *   Chrome을 종료하지 않고 macOS Keychain + Chrome SQLite Cookie DB를 직접 읽어
 *   Playwright storageState 형식으로 변환, sessions/ 디렉토리에 저장
 *
 * macOS 전용 스크립트입니다.
 */

const { execSync, spawnSync } = require('child_process');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

// ─── 플랫폼 설정 ────────────────────────────────────────────

const PLATFORMS = {
  coinglass: {
    name: 'Coinglass',
    sessionFile: 'coinglass-session.json',
    // Google 로그인 쿠키도 포함 (Coinglass Pro는 Google SSO 사용)
    domains: ['.coinglass.com', 'www.coinglass.com', '.google.com', 'accounts.google.com'],
  },
  coinalyze: {
    name: 'Coinalyze',
    sessionFile: 'coinalyze-session.json',
    domains: ['.coinalyze.net', 'coinalyze.net'],
  },
  hyblock: {
    name: 'Hyblock Capital',
    sessionFile: 'hyblock-session.json',
    domains: ['.hyblockcapital.com', 'www.hyblockcapital.com'],
  },
  tradingview: {
    name: 'TradingView',
    sessionFile: 'tv-session.json',
    domains: ['.tradingview.com', 'www.tradingview.com'],
  },
};

// ─── Chrome 경로 설정 ────────────────────────────────────────

const CHROME_USER_DATA_DIR = path.join(
  os.homedir(),
  'Library/Application Support/Google/Chrome'
);
const TEMP_DB = '/tmp/chrome_cookies_grab_tmp.db';

/** Chrome 프로필 디렉토리 목록 반환 (Default + Profile N) */
function getChromeProfiles() {
  const profiles = [];
  try {
    const entries = fs.readdirSync(CHROME_USER_DATA_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      if (entry.name !== 'Default' && !/^Profile \d+$/.test(entry.name)) continue;
      const dbPath = path.join(CHROME_USER_DATA_DIR, entry.name, 'Cookies');
      if (fs.existsSync(dbPath)) profiles.push(dbPath);
    }
  } catch {}
  return profiles;
}

const SESSION_DIR = path.join(__dirname, '..', 'sessions');

// ─── macOS Keychain에서 Chrome AES 키 조회 ─────────────────

function getChromeAESKey() {
  const result = spawnSync(
    'security',
    ['find-generic-password', '-w', '-s', 'Chrome Safe Storage', '-a', 'Chrome'],
    { encoding: 'utf8' }
  );

  if (result.status !== 0) {
    throw new Error(
      'macOS Keychain에서 Chrome 암호화 키를 가져올 수 없습니다.\n' +
      '이 스크립트는 macOS 전용입니다.'
    );
  }

  const password = result.stdout.trim();
  // Chrome macOS 암호화 방식:
  // key = PBKDF2(password, salt='saltysalt', iterations=1003, keylen=16, hash='sha1')
  return crypto.pbkdf2Sync(password, 'saltysalt', 1003, 16, 'sha1');
}

// ─── 쿠키 복호화 ─────────────────────────────────────────────

/**
 * 바이트 버퍼에서 가장 긴 연속 printable ASCII 구간을 추출.
 *
 * toString('utf8')를 쓰면 잘못된 UTF-8 시퀀스가 U+FFFD(3바이트)로 병합되어
 * 중간에 garbage가 섞여도 경계 제거로는 걸러낼 수 없다.
 * toString('latin1')은 각 바이트를 1:1로 char에 매핑하므로 non-printable 바이트가
 * 서로 합산되지 않고 분리된 채로 남아, printable 구간만 깔끔하게 추출할 수 있다.
 *
 * @param {Buffer} buf - 복호화된 raw 바이트
 * @param {number} minLen - 유효 쿠키로 인정할 최소 길이 (기본 4)
 * @returns {string} 가장 긴 printable ASCII 구간, 없으면 빈 문자열
 */
function extractPrintableRun(buf, minLen = 4) {
  // latin1: byte N → charCode N (1:1 매핑, 병합 없음)
  const str = buf.toString('latin1');
  let bestStart = 0, bestLen = 0;
  let runStart = -1;

  for (let i = 0; i <= str.length; i++) {
    const code = i < str.length ? str.charCodeAt(i) : -1;
    const printable = code >= 0x20 && code <= 0x7E;

    if (printable) {
      if (runStart === -1) runStart = i;
    } else {
      if (runStart !== -1) {
        const len = i - runStart;
        if (len > bestLen) { bestLen = len; bestStart = runStart; }
        runStart = -1;
      }
    }
  }

  return bestLen >= minLen ? str.slice(bestStart, bestStart + bestLen) : '';
}

function decryptCookieValue(hexEncrypted, aesKey) {
  if (!hexEncrypted || hexEncrypted.length === 0) return '';

  const buf = Buffer.from(hexEncrypted, 'hex');
  if (buf.length === 0) return '';

  const prefix = buf.slice(0, 3).toString('ascii');

  if (prefix === 'v10') {
    // Chrome macOS 표준 암호화: AES-128-CBC
    // Key = PBKDF2(keychain_pass, 'saltysalt', 1003, 16, SHA1)
    // IV  = 16 × 스페이스 (0x20)
    //
    // 주의: 최신 Chrome(v10 포맷)은 실제 쿠키 값 앞에 32바이트 internal prefix
    // (nonce/authentication data)를 추가한 후 암호화한다.
    // 따라서 복호화 결과의 첫 32바이트를 건너뛰어야 실제 값을 얻을 수 있다.
    const iv = Buffer.alloc(16).fill(0x20);
    const ciphertext = buf.slice(3);
    try {
      const decipher = crypto.createDecipheriv('aes-128-cbc', aesKey, iv);
      decipher.setAutoPadding(true);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      // 처음 32바이트(2 AES 블록) = Chrome internal prefix → 건너뜀
      // latin1 1:1 매핑 후 가장 긴 printable 구간 추출
      const payload = decrypted.length > 32 ? decrypted.slice(32) : decrypted;
      const clean = extractPrintableRun(payload);
      return clean.length > 0 ? clean : null;
    } catch {
      return null;
    }
  }

  // v20 (Chrome 127+ App-Bound Encryption) — Chrome 프로세스 없이는 복호화 불가
  if (prefix === 'v20') return null;

  // 평문 쿠키: latin1로 printable 구간만 추출
  const clean = extractPrintableRun(buf);
  return clean.length > 0 ? clean : null;
}

// ─── Chrome epoch → Unix epoch 변환 ─────────────────────────

function chromeTimeToUnix(chromeTime) {
  if (!chromeTime || chromeTime === '0') return -1;
  // Chrome epoch: 마이크로초, 기준 1601-01-01
  // Unix epoch: 초, 기준 1970-01-01
  // 차이: 11644473600초
  const unixSeconds = Number(BigInt(chromeTime) / 1_000_000n) - 11_644_473_600;
  return unixSeconds > 0 ? unixSeconds : -1;
}

// ─── SameSite 숫자 → 문자열 변환 ────────────────────────────

function parseSameSite(value) {
  const map = { '-1': 'Lax', '0': 'Lax', '1': 'Strict', '2': 'None' };
  return map[String(value)] || 'Lax';
}

// ─── Chrome Cookie DB 쿼리 (전체 프로필 스캔) ───────────────

/**
 * 모든 Chrome 프로필을 스캔하여 대상 도메인 쿠키를 수집.
 * 동일 (name, domain) 조합이 여러 프로필에 있으면 더 많은 쿠키를 가진
 * 프로필의 값을 우선 사용 (obe 등 인증 쿠키를 놓치지 않기 위해).
 * @returns {Map<string, string>} "name\x1Fdomain" → raw TSV line
 */
function queryCookiesAllProfiles(domains) {
  const profileDbs = getChromeProfiles();
  if (profileDbs.length === 0) {
    throw new Error(
      `Chrome Cookies DB를 찾을 수 없습니다: ${CHROME_USER_DATA_DIR}\n` +
      'Chrome이 설치되어 있고 기본 프로필을 사용 중인지 확인하세요.'
    );
  }

  const domainConditions = domains
    .map((d) => `host_key LIKE '${d.replace(/'/g, "''")}'`)
    .join(' OR ');

  const sql = [
    'SELECT host_key, name, value, hex(encrypted_value) as enc_value,',
    'path, expires_utc, is_secure, is_httponly, samesite',
    'FROM cookies',
    `WHERE ${domainConditions}`,
  ].join(' ');

  // 프로필별로 쿠키 수집: Map<"name|domain" → {line, count}>
  // 쿠키가 더 많은 프로필(= 더 완전히 로그인된 프로필)의 값을 우선
  const bestByProfile = new Map(); // key → line
  const profileCookieCount = new Map(); // dbPath → count
  const profileLines = new Map(); // dbPath → lines[]

  for (const dbPath of profileDbs) {
    try {
      fs.copyFileSync(dbPath, TEMP_DB);
    } catch {
      continue; // 잠긴 파일 스킵
    }

    const result = spawnSync(
      'sqlite3',
      ['-separator', '\x1F', TEMP_DB, sql],
      { encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 }
    );

    if (result.status !== 0) continue;

    const lines = result.stdout
      .toString('utf8')
      .trim()
      .split('\n')
      .filter((l) => l.trim().length > 0);

    if (lines.length > 0) {
      profileLines.set(dbPath, lines);
      profileCookieCount.set(dbPath, lines.length);
    }
  }

  if (profileCookieCount.size === 0) return '';

  // 각 (domain+name) 키에 대해 가장 많은 쿠키를 가진 프로필의 값을 사용
  // (더 많이 로그인된 프로필 = 더 신뢰할 수 있는 세션)
  const merged = new Map(); // "host|name" → line
  const sortedProfiles = [...profileLines.entries()].sort(
    ([, a], [, b]) => b.length - a.length // 쿠키 수 내림차순
  );

  for (const [, lines] of sortedProfiles) {
    for (const line of lines) {
      const parts = line.split('\x1F');
      if (parts.length < 2) continue;
      const key = `${parts[0]}|${parts[1]}`; // host_key|name
      if (!merged.has(key)) merged.set(key, line); // 이미 있으면 유지 (상위 프로필 우선)
    }
  }

  return [...merged.values()].join('\n');
}

// ─── 세션 추출 메인 로직 ─────────────────────────────────────

function grabSession(platformKey) {
  const platform = PLATFORMS[platformKey];
  if (!platform) {
    console.error(`❌ 알 수 없는 플랫폼: ${platformKey}`);
    console.log(`지원 플랫폼: ${Object.keys(PLATFORMS).join(', ')}, all`);
    process.exit(1);
  }

  const sessionPath = path.join(SESSION_DIR, platform.sessionFile);
  console.log(`\n🔍 ${platform.name} 세션 추출 중...`);
  console.log(`   도메인: ${platform.domains.join(', ')}`);

  // 1. AES 키 조회
  let aesKey;
  try {
    aesKey = getChromeAESKey();
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  // 2. Cookie DB 쿼리 (모든 프로필 스캔)
  let rawOutput;
  try {
    rawOutput = queryCookiesAllProfiles(platform.domains);
  } catch (err) {
    console.error(`❌ ${err.message}`);
    process.exit(1);
  }

  // 3. 파싱 및 복호화
  const cookies = [];
  let skipped = 0;

  const lines = rawOutput.trim().split('\n').filter((l) => l.trim().length > 0);

  for (const line of lines) {
    const parts = line.split('\x1F');
    if (parts.length < 9) continue;

    const [hostKey, name, value, encValue, cookiePath, expiresUtc, isSecure, isHttponly, samesite] = parts;

    // 복호화: encrypted_value가 있으면 복호화, 없으면 value 사용
    let cookieValue = value;
    if (encValue && encValue.length > 0) {
      const decrypted = decryptCookieValue(encValue.trim(), aesKey);
      if (decrypted === null) {
        skipped++;
        continue; // 복호화 실패 쿠키 스킵
      }
      if (decrypted.length > 0) cookieValue = decrypted;
    }

    cookies.push({
      name: name,
      value: cookieValue,
      domain: hostKey,
      path: cookiePath || '/',
      expires: chromeTimeToUnix(expiresUtc),
      httpOnly: isHttponly === '1',
      secure: isSecure === '1',
      sameSite: parseSameSite(samesite),
    });
  }

  if (cookies.length === 0) {
    console.warn(`⚠️  ${platform.name} 쿠키를 찾을 수 없습니다.`);
    console.warn('   Chrome에서 해당 사이트에 로그인되어 있는지 확인하세요.');
    return false;
  }

  // 4. storageState 형식으로 저장
  fs.mkdirSync(SESSION_DIR, { recursive: true });
  const storageState = { cookies, origins: [] };
  fs.writeFileSync(sessionPath, JSON.stringify(storageState, null, 2));

  if (skipped > 0) {
    console.warn(`   ⚠️  복호화 실패로 ${skipped}개 쿠키 제외됨`);
  }
  console.log(`✅ ${platform.name} 세션 저장 완료: ${platform.sessionFile} (쿠키 ${cookies.length}개)`);
  return true;
}

// ─── 임시 파일 정리 ──────────────────────────────────────────

function cleanup() {
  try {
    if (fs.existsSync(TEMP_DB)) fs.unlinkSync(TEMP_DB);
  } catch {}
}

// ─── 메인 실행 ───────────────────────────────────────────────

(async () => {
  const target = process.argv[2] || 'all';

  console.log('=== Chrome 세션 추출기 (실행 중 Chrome 지원) ===');
  console.log('Chrome을 종료하지 않아도 됩니다.\n');

  try {
    if (target === 'all') {
      let successCount = 0;
      for (const key of Object.keys(PLATFORMS)) {
        if (grabSession(key)) successCount++;
      }
      console.log(`\n🎉 완료 — ${successCount}/${Object.keys(PLATFORMS).length}개 플랫폼 세션 저장됨`);
    } else {
      grabSession(target);
    }
  } finally {
    cleanup();
  }
})();
