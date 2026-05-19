'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_LEDGER_PATH = path.join(__dirname, '..', '..', 'sessions', 'notifications-sent.json');
const WINDOW_MS = 1 * 60 * 60 * 1000;

function getLedgerPath() {
  return process.env._TEST_LEDGER_PATH || DEFAULT_LEDGER_PATH;
}

function readLedger() {
  const p = getLedgerPath();
  try {
    return JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    return { entries: [] };
  }
}

function writeLedger(data) {
  const p = getLedgerPath();
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(p, JSON.stringify(data, null, 2));
}

function priceDecimalsFor(pair) {
  if (/^(BTC|ETH)USDT$/.test(pair)) return 1;
  return 3;
}

/** Returns the dedup key for a signal. */
function dedupKey(signal) {
  const price = Number(signal?.entry?.price ?? NaN);
  const priceKey = Number.isFinite(price)
    ? price.toFixed(priceDecimalsFor(signal.pair))
    : 'NA';
  return `${signal.pair}_${signal.analysisDate}_${signal.direction}_${signal.tier}_${priceKey}`;
}

/**
 * Returns true if a notification with this key was sent within the window.
 *
 * @param {string} key
 * @param {number} [windowMs]
 */
function hasRecentNotification(key, windowMs = WINDOW_MS) {
  const { entries } = readLedger();
  const cutoff = Date.now() - windowMs;
  return entries.some(e => e.key === key && e.sentAt > cutoff);
}

/**
 * Records a sent notification and prunes stale entries.
 *
 * @param {string} key
 * @param {{ pair: string, direction: string, tier: number, messageId: number }} meta
 */
function recordNotification(key, meta) {
  const { entries } = readLedger();
  const cutoff = Date.now() - WINDOW_MS;
  const fresh = entries.filter(e => e.sentAt > cutoff);
  fresh.push({ key, sentAt: Date.now(), ...meta });
  writeLedger({ entries: fresh });
}

module.exports = { dedupKey, hasRecentNotification, recordNotification, priceDecimalsFor };
