'use strict';

const fs = require('node:fs');
const path = require('node:path');

const DEFAULT_LEDGER_PATH = path.join(__dirname, '..', '..', 'sessions', 'notifications-sent.json');
const WINDOW_MS = 15 * 60 * 1000; // 15분 dedup window (매분 신호 재생성 대응)
const ENTRY_PRICE_WINDOW_MS = 60 * 60 * 1000; // 1시간 — 동일 진입가 시그널 중복 방지
const PRUNE_WINDOW_MS = Math.max(WINDOW_MS, ENTRY_PRICE_WINDOW_MS);

function getLedgerPath() {
  return process.env._TEST_LEDGER_PATH || DEFAULT_LEDGER_PATH;
}

function readLedger() {
  const p = getLedgerPath();
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
    // 깨진 JSON 또는 entries가 배열이 아닌 경우 방어
    if (!data || !Array.isArray(data.entries)) return { entries: [] };
    return data;
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

/** Returns the dedup key for a signal (tier + date included). */
function dedupKey(signal) {
  const price = Number(signal?.entry?.price ?? NaN);
  const priceKey = Number.isFinite(price)
    ? price.toFixed(priceDecimalsFor(signal.pair))
    : 'NA';
  return `${signal.pair}_${signal.analysisDate}_${signal.direction}_${signal.tier}_${priceKey}`;
}

/** Returns the entry-price dedup key — pair + direction + price only (no date/tier). */
function entryPriceDedupKey(signal) {
  const price = Number(signal?.entry?.price ?? NaN);
  const priceKey = Number.isFinite(price)
    ? price.toFixed(priceDecimalsFor(signal.pair))
    : 'NA';
  return `${signal.pair}_${signal.direction}_ep_${priceKey}`;
}

/**
 * Returns true if a notification with this key was sent within the window.
 *
 * @param {string} key
 * @param {number} [windowMs]
 */
function hasRecentNotification(key, windowMs = WINDOW_MS) {
  const { entries } = readLedger();
  // entries가 배열이 아닌 경우 (깨진 JSON / corrupt state) — safe fallback
  if (!Array.isArray(entries)) return false;
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
  const cutoff = Date.now() - PRUNE_WINDOW_MS;
  const fresh = entries.filter(e => e.sentAt > cutoff);
  fresh.push({ key, sentAt: Date.now(), ...meta });
  writeLedger({ entries: fresh });
}

module.exports = { dedupKey, entryPriceDedupKey, hasRecentNotification, recordNotification, priceDecimalsFor, ENTRY_PRICE_WINDOW_MS };
