'use strict';

const fs   = require('fs');
const path = require('path');
const { analyzeICT }     = require('../scripts/ict-engine');
const { fetchCandleSet } = require('../scripts/utils/binance');
const { buildDiary }     = require('../scripts/modules/diary');
const { loadPairs }      = require('../scripts/utils/pair-config');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const pairs = loadPairs();

  const results = await Promise.all(pairs.map(async ({ symbol, skipOnError }) => {
    try {
      const { htf, ltf, d1 } = await fetchCandleSet(symbol);
      const signal = await analyzeICT({ htfCandles: htf, ltfCandles: ltf, d1Candles: d1, pair: symbol });
      const diary  = buildDiary(signal);

      try {
        fs.writeFileSync(path.join('/tmp', `${symbol}_latest.json`), JSON.stringify(signal));
        fs.writeFileSync(path.join('/tmp', `${symbol}_latest_diary.txt`), diary);
      } catch (_) {}

      return { pair: symbol, direction: signal.direction, tier: signal.tier, confidence: signal.confidence };
    } catch (err) {
      if (skipOnError) return { pair: symbol, error: err.message };
      return { pair: symbol, error: err.message };
    }
  }));

  return res.status(200).json({ ok: true, results });
};
