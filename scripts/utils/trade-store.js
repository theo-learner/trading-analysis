'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const ROOT       = path.join(__dirname, '..', '..');
const OPEN_DIR   = path.join(ROOT, 'trades', 'live', 'open');
const CLOSED_DIR = path.join(ROOT, 'trades', 'live', 'closed');
const INDEX_FILE = path.join(ROOT, 'trades', 'live', 'index.json');

function ensureDirs() {
  fs.mkdirSync(OPEN_DIR,   { recursive: true });
  fs.mkdirSync(CLOSED_DIR, { recursive: true });
}

function atomicWrite(filePath, data) {
  const tmp = filePath + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
  fs.renameSync(tmp, filePath);
}

function readIndex() {
  try { return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf-8')); } catch { return []; }
}

function writeIndex(entries) {
  fs.mkdirSync(path.dirname(INDEX_FILE), { recursive: true });
  atomicWrite(INDEX_FILE, entries);
}

/** Upsert a single trade (routes to open/ or closed/ based on trade.status). */
function saveTrade(trade) {
  ensureDirs();
  const isOpen   = trade.status === 'open';
  const dir      = isOpen ? OPEN_DIR : CLOSED_DIR;
  const filePath = path.join(dir, `${trade.id}.json`);
  atomicWrite(filePath, trade);

  // Maintain index
  const index = readIndex();
  const existing = index.findIndex(e => e.id === trade.id);
  const entry = { id: trade.id, pair: trade.pair, direction: trade.direction, status: trade.status, createdAt: trade.entry?.requestedAt ?? new Date().toISOString() };
  if (existing >= 0) index[existing] = entry;
  else index.unshift(entry);
  writeIndex(index);
}

/**
 * Move a trade from open/ to closed/ (updates status to 'closed').
 * Caller should set trade.status, closedAt, closedReason, realizedPnl before calling.
 */
function closeTrade(trade) {
  ensureDirs();
  const openPath = path.join(OPEN_DIR, `${trade.id}.json`);
  const closedPath = path.join(CLOSED_DIR, `${trade.id}.json`);
  atomicWrite(closedPath, trade);
  try { fs.unlinkSync(openPath); } catch {}

  const index = readIndex();
  const i = index.findIndex(e => e.id === trade.id);
  if (i >= 0) {
    index[i].status = trade.status;
    index[i].closedAt = trade.closedAt;
    writeIndex(index);
  }
}

/** Returns all open trades as an array. */
function openTrades() {
  ensureDirs();
  return fs.readdirSync(OPEN_DIR)
    .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
    .map(f => {
      try { return JSON.parse(fs.readFileSync(path.join(OPEN_DIR, f), 'utf-8')); } catch { return null; }
    })
    .filter(Boolean);
}

/** Returns closed trades sorted newest first, optionally limited. */
function closedTrades(limit = 100) {
  ensureDirs();
  return fs.readdirSync(CLOSED_DIR)
    .filter(f => f.endsWith('.json') && !f.endsWith('.tmp'))
    .map(f => {
      try {
        const t = JSON.parse(fs.readFileSync(path.join(CLOSED_DIR, f), 'utf-8'));
        return t;
      } catch { return null; }
    })
    .filter(Boolean)
    .sort((a, b) => new Date(b.closedAt ?? 0) - new Date(a.closedAt ?? 0))
    .slice(0, limit);
}

/** Returns a single trade by id (checks open first, then closed). */
function getTrade(id) {
  const openPath   = path.join(OPEN_DIR,   `${id}.json`);
  const closedPath = path.join(CLOSED_DIR, `${id}.json`);
  for (const p of [openPath, closedPath]) {
    try { return JSON.parse(fs.readFileSync(p, 'utf-8')); } catch {}
  }
  return null;
}

/** Count of currently open trades. */
function openCount() {
  try {
    return fs.readdirSync(OPEN_DIR).filter(f => f.endsWith('.json') && !f.endsWith('.tmp')).length;
  } catch { return 0; }
}

/** True if there is an open trade for the given pair. */
function hasOpenTrade(pair) {
  return openTrades().some(t => t.pair === pair);
}

module.exports = { saveTrade, closeTrade, openTrades, closedTrades, getTrade, openCount, hasOpenTrade };
