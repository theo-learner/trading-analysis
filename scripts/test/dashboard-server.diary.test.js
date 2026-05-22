'use strict';

const { describe, it, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs     = require('fs');
const os     = require('os');
const path   = require('path');

const { buildDiaryEntry } = require('../dashboard-server');
const { buildDiary }      = require('../modules/diary');

const FIXTURES = path.join(__dirname, 'modules', 'fixtures');
const enterSignal   = require(path.join(FIXTURES, 'diary-full-enter.json'));
const neutralSignal = require(path.join(FIXTURES, 'diary-neutral.json'));

let tmpDir;

before(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'diary-test-'));
});

after(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

function makeDeps(signalFixture) {
  return {
    fetchCandleSet: async () => ({ htf: [], ltf: [], h1: [], d1: [] }),
    analyzeICT:     async () => signalFixture,
    buildDiary,
    diaryDir: tmpDir,
  };
}

describe('buildDiaryEntry', () => {
  it('returns ok:true with diary string and filename for ENTER signal', async () => {
    const result = await buildDiaryEntry('BTCUSDT', makeDeps(enterSignal));
    assert.strictEqual(result.ok, true);
    assert.ok(typeof result.diary === 'string');
    assert.match(result.diary, /# 구조 다이어리/);
    assert.match(result.filename, /BTCUSDT_15m_.*\.md/);
  });

  it('writes diary file to diaryDir', async () => {
    await buildDiaryEntry('BTCUSDT', makeDeps(enterSignal));
    const files = fs.readdirSync(tmpDir);
    assert.ok(files.some(f => f.startsWith('BTCUSDT_15m_')));
  });

  it('returns signal in response', async () => {
    const result = await buildDiaryEntry('BTCUSDT', makeDeps(enterSignal));
    assert.ok(result.signal != null);
    assert.strictEqual(result.signal.pair, 'BTCUSDT');
  });

  it('works for NEUTRAL signal', async () => {
    const result = await buildDiaryEntry('HYPEUSDT', makeDeps(neutralSignal));
    assert.strictEqual(result.ok, true);
    assert.match(result.diary, /심화 단계 생략/);
  });

  it('includes frontmatter in written file', async () => {
    await buildDiaryEntry('BTCUSDT', makeDeps(enterSignal));
    const files = fs.readdirSync(tmpDir).filter(f => f.startsWith('BTCUSDT_15m_')).sort();
    const content = fs.readFileSync(path.join(tmpDir, files[files.length - 1]), 'utf8');
    assert.match(content, /^---/);
    assert.match(content, /pair: BTCUSDT/);
    assert.match(content, /scorecardGrade:/);
  });
});

describe('getPairsResponse', () => {
  it('PairConfig 배열을 반환한다', () => {
    const { getPairsResponse } = require('../dashboard-server');
    const resp = getPairsResponse();
    assert.ok(Array.isArray(resp.pairs));
    assert.ok(resp.pairs.length > 0);
    for (const p of resp.pairs) {
      assert.equal(typeof p.symbol, 'string');
      assert.ok(['binance', 'bybit'].includes(p.exchange));
      assert.ok(['binance', 'bybit'].includes(p.chartSource));
      assert.equal(typeof p.skipOnError, 'boolean');
    }
  });
});
