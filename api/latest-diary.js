'use strict';

const fs   = require('fs');
const path = require('path');

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const pair = ((req.query && req.query.pair) || 'BTCUSDT').toUpperCase();
  const cacheFile = path.join('/tmp', `${pair}_latest_diary.txt`);

  try {
    if (fs.existsSync(cacheFile)) {
      return res.status(200).json({ ok: true, diary: fs.readFileSync(cacheFile, 'utf8') });
    }
  } catch (_) {}

  return res.status(200).json({ ok: false, diary: '' });
};
