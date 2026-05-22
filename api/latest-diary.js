'use strict';

const fs   = require('fs');
const path = require('path');
const { analyzeICT }     = require('../scripts/ict-engine');
const { fetchCandleSet } = require('../scripts/utils/binance');
const { buildDiary }     = require('../scripts/modules/diary');

const CACHE_TTL = 15 * 60 * 1000; // 15분

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pair      = ((req.query && req.query.pair) || 'BTCUSDT').toUpperCase();
  const cacheFile = path.join('/tmp', `${pair}_latest_diary.txt`);
  const sigFile   = path.join('/tmp', `${pair}_latest.json`);

  // 캐시 유효하면 즉시 반환
  try {
    if (fs.existsSync(cacheFile)) {
      const stat = fs.statSync(cacheFile);
      if (Date.now() - stat.mtimeMs < CACHE_TTL) {
        return res.status(200).json({ ok: true, diary: fs.readFileSync(cacheFile, 'utf8') });
      }
    }
  } catch (_) {}

  // 캐시 없거나 만료 → 직접 분석 실행
  try {
    const { htf, ltf, d1 } = await fetchCandleSet(pair);
    const signal = await analyzeICT({ htfCandles: htf, ltfCandles: ltf, d1Candles: d1, pair });
    const diary  = buildDiary(signal);

    try {
      fs.writeFileSync(sigFile,   JSON.stringify(signal));
      fs.writeFileSync(cacheFile, diary);
    } catch (_) {}

    return res.status(200).json({ ok: true, diary });
  } catch (err) {
    return res.status(500).json({ ok: false, diary: '' });
  }
};
