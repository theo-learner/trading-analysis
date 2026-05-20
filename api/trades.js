'use strict';

const fs   = require('fs');
const path = require('path');

const TRADES_FILE = path.join('/tmp', 'trades.json');

function loadTrades() {
  try { return JSON.parse(fs.readFileSync(TRADES_FILE, 'utf8')); } catch (_) { return []; }
}

module.exports = function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method === 'GET') {
    return res.status(200).json(loadTrades());
  }

  if (req.method === 'POST') {
    const signal = req.body && req.body.signal;
    if (!signal) return res.status(400).json({ error: 'signal required' });

    const trades = loadTrades();
    trades.unshift({ ...signal, savedAt: new Date().toISOString() });
    try { fs.writeFileSync(TRADES_FILE, JSON.stringify(trades.slice(0, 50))); } catch (_) {}
    return res.status(200).json({ ok: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
