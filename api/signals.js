'use strict';

const fs   = require('fs');
const path = require('path');

const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'HYPEUSDT'];

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const signals = [];
  for (const pair of PAIRS) {
    try {
      const f = path.join('/tmp', `${pair}_latest.json`);
      if (fs.existsSync(f)) signals.push(JSON.parse(fs.readFileSync(f, 'utf8')));
    } catch (_) {}
  }

  signals.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  return res.status(200).json(signals);
};
