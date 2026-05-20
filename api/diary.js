'use strict';

const fs   = require('fs');
const path = require('path');
const { analyzeICT }    = require('../scripts/ict-engine');
const { fetchCandleSet } = require('../scripts/utils/binance');
const { buildDiary }    = require('../scripts/modules/diary');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const pair = ((req.body && req.body.pair) || 'BTCUSDT').toUpperCase();

  try {
    const { htf, ltf, d1 } = await fetchCandleSet(pair);
    const signal = await analyzeICT({ htfCandles: htf, ltfCandles: ltf, d1Candles: d1, pair });
    const diary  = buildDiary(signal);

    try {
      fs.writeFileSync(path.join('/tmp', `${pair}_latest_diary.txt`), diary);
    } catch (_) {}

    return res.status(200).json({ ok: true, diary });
  } catch (err) {
    return res.status(500).json({ ok: false, message: err.message });
  }
};
