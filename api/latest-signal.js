'use strict';

const fs   = require('fs');
const path = require('path');
const { analyzeICT }    = require('../scripts/ict-engine');
const { fetchCandleSet } = require('../scripts/utils/binance');

const CACHE_TTL = 15 * 60 * 1000; // 15분

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pair = ((req.query && req.query.pair) || 'BTCUSDT').toUpperCase();
  const cacheFile = path.join('/tmp', `${pair}_latest.json`);

  try {
    if (fs.existsSync(cacheFile)) {
      const cached = JSON.parse(fs.readFileSync(cacheFile, 'utf8'));
      if (Date.now() - cached.timestamp * 1000 < CACHE_TTL) {
        return res.status(200).json(cached);
      }
    }
  } catch (_) {}

  try {
    const { htf, ltf, d1 } = await fetchCandleSet(pair);
    const signal = await analyzeICT({ htfCandles: htf, ltfCandles: ltf, d1Candles: d1, pair });
    try {
      fs.writeFileSync(cacheFile, JSON.stringify(signal));
    } catch (_) {}
    return res.status(200).json(signal);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
