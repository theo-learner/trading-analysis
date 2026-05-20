'use strict';

const fs   = require('fs');
const path = require('path');
const { analyzeICT }    = require('../scripts/ict-engine');
const { fetchCandleSet } = require('../scripts/utils/binance');

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

    try {
      fs.writeFileSync(path.join('/tmp', `${pair}_latest.json`), JSON.stringify(signal));
    } catch (_) {}

    return res.status(200).json(signal);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
