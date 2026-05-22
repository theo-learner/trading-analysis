'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ENV_PATH = path.join(__dirname, '..', '..', 'sessions', 'trade.env');

/**
 * Parses sessions/trade.env and returns key-value pairs.
 * Returns empty object if file doesn't exist (safe fallback).
 *
 * @returns {Record<string, string>}
 */
function loadTradeEnv() {
  if (!fs.existsSync(ENV_PATH)) return {};
  const lines = fs.readFileSync(ENV_PATH, 'utf8').split('\n');
  const out = {};
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim();
    if (val) out[key] = val;
  }
  return out;
}

module.exports = { loadTradeEnv };
