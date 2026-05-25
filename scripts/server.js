'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { runSQL, initDB, ensureTable, closeDB } = require('./db-driver');

// ── helpers ──────────────────────────────────────────────────────────────────
function json(res, d, s = 200) {
  res.writeHead(s, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(d));
}

function jsonStream(res, s = 200) {
  res.writeHead(s, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  return res;
}

// ── pairs ────────────────────────────────────────────────────────────────────
const DEFAULT_PAIRS = [
  { symbol: 'BTCUSDT',   exchange: 'binance', chartSource: 'binance', skipOnError: false },
  { symbol: 'ETHUSDT',   exchange: 'binance', chartSource: 'binance', skipOnError: false },
  { symbol: 'SOLUSDT',   exchange: 'binance', chartSource: 'binance', skipOnError: false },
  { symbol: 'HYPEUSDT',  exchange: 'binance', chartSource: 'bybit',   skipOnError: false },
  { symbol: 'ZECUSDT',   exchange: 'binance', chartSource: 'binance', skipOnError: true  },
  { symbol: 'MORPHOUSDT',exchange: 'binance', chartSource: 'binance', skipOnError: true  },
];

async function getPairs() {
  try {
    const { rows } = await runSQL('SELECT * FROM pairs_config ORDER BY sort_order ASC');
    if (rows.length > 0) return rows.map(r => ({
      symbol: r.pair,
      exchange: r.exchange,
      chartSource: r.chart_source || 'binance',
      skipOnError: !!r.skip_on_error,
    }));
  } catch (_) {}
  return DEFAULT_PAIRS;
}

async function upsertPairs(pairs) {
  for (const p of pairs) {
    await runSQL(
      `INSERT INTO pairs_config (pair, exchange, chart_source, skip_on_error, sort_order)
       VALUES ($1,$2,$3,$4,$5)
       ON CONFLICT (pair) DO UPDATE SET
         exchange=EXCLUDED.exchange,
         chart_source=EXCLUDED.chart_source,
         skip_on_error=EXCLUDED.skip_on_error,
         sort_order=EXCLUDED.sort_order`,
      [p.symbol, p.exchange, p.chartSource || 'binance', !!p.skipOnError, p.sortOrder || 0]
    );
  }
}

// ── config ───────────────────────────────────────────────────────────────────
async function getConfig() {
  try {
    const { rows } = await runSQL('SELECT * FROM dashboard_config LIMIT 1');
    if (rows.length > 0) return rows[0];
  } catch (_) {}
  return { mode: 'DRY-RUN' };
}

async function updateConfig(updates) {
  await runSQL(`INSERT INTO dashboard_config (mode) VALUES ($1) ON CONFLICT DO NOTHING`, [updates.mode || 'DRY-RUN']);
  return await getConfig();
}

// ── signals ──────────────────────────────────────────────────────────────────
async function getLatestSignal(pair) {
  const { rows } = await runSQL(`SELECT * FROM signals WHERE pair=$1 ORDER BY created_at DESC LIMIT 1`, [pair.toUpperCase()]);
  return rows[0] || null;
}

// ── diary ────────────────────────────────────────────────────────────────────
async function getLatestDiary(pair) {
  const { rows } = await runSQL(`SELECT * FROM diaries WHERE pair=$1 ORDER BY created_at DESC LIMIT 1`, [pair.toUpperCase()]);
  return rows[0] || null;
}

// ── trades (existing) ────────────────────────────────────────────────────────
async function getLedger() {
  const { rows: trades } = await runSQL('SELECT * FROM trades ORDER BY created_at DESC');
  const closed = trades.filter(t => t.status === 'closed');
  const open = trades.filter(t => t.status === 'open');
  const total = closed.length;
  const wins = closed.filter(t => t.realized_pnl > 0).length;
  const losses = closed.filter(t => t.realized_pnl <= 0).length;
  const totalPnL = Math.round(closed.reduce((s, t) => s + (t.realized_pnl || 0), 0) * 100) / 100;
  const avgPnL = total > 0 ? Math.round((totalPnL / total) * 100) / 100 : 0;
  const winRate = total > 0 ? Math.round((wins / total) * 10000) / 100 : 0;
  const formatted = closed.map(t => ({
    id: t.id, pair: t.pair, direction: t.direction,
    entry: { filled: t.entry_filled, price: t.entry_price },
    tp: [{ filledPrice: t.tp_filled, price: t.tp_price }],
    realizedPnl: t.realized_pnl, status: t.status, mode: t.mode,
    closedAt: t.closed_at, createdAt: t.created_at,
    closedReason: t.closed_reason, leverage: t.leverage, sl: t.sl
  }));
  return { closed: formatted, open, stats: { total, wins, losses, winRate, totalPnL, avgPnL } };
}

async function getStats() {
  const l = await getLedger();
  return { closed: l.closed.length, stats: l.stats };
}

// ── Sync from Bybit ───────────────────────────────────────────────────────────
async function syncFromBybit(req, res) {
  try {
    const apiKey = process.env.BYBIT_API_KEY;
    const apiSecret = process.env.BYBIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      return json(res, { message: 'Bybit API credentials not configured', imported: 0 }, 500);
    }

    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    
    // Bybit V5 signature: GET/v5/order/history?category=linear&limit=100&timestamp=xxx&recvWindow=xxx
    const queryString = `category=linear&limit=100&timestamp=${timestamp}&recvWindow=${recvWindow}`;
    const signStr = `GET/v5/order/history?${queryString}`;
    const crypto = require('crypto');
    const signature = crypto.createHmac('sha256', apiSecret).update(signStr).digest('hex');
    
    const url = `https://api.bybit.com/v5/order/history?${queryString}&signature=${signature}`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(10_000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'X-Bit-Api-Key': apiKey,
        'X-Bit-Api-Timestamp': timestamp,
        'X-Bit-Api-Sign': signature,
      },
    });
    if (!resp.ok) {
      const errText = await resp.text();
      return json(res, { message: `Bybit API error: ${resp.status} - ${errText}`, imported: 0 }, resp.status);
    }
    const data = await resp.json();
    if (data.retCode !== 0) {
      return json(res, { message: `Bybit API: ${data.retMsg}`, imported: 0 }, 400);
    }

    const orders = data.result?.list || [];
    let imported = 0, skipped = 0;

    for (const o of orders) {
      if (!o.orderId) continue;
      const exists = await runSQL('SELECT 1 FROM trades WHERE id=$1', [o.orderId]);
      if (exists.rows.length > 0) { skipped++; continue; }

      const pair = o.symbol || '';
      const direction = o.side === 'Buy' ? 'LONG' : 'SHORT';
      const status = (o.orderStatus === 'Filled' || o.orderStatus === 'Closed') ? 'closed' : 'open';
      const realizedPnl = parseFloat(o.realizedPnl || 0);
      const isWin = status === 'closed' && realizedPnl > 0;
      const closedReason = isWin ? 'TP' : (o.closeReason || null);
      const avgPrice = parseFloat(o.avgPrice || o.price || o.execPrice || 0);
      const qty = parseFloat(o.execQty || o.qty || 0);

      await runSQL(
        `INSERT INTO trades (id, pair, direction, entry_price, qty, status, mode, realized_pnl, closed_reason, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NOW())`,
        [o.orderId, pair, direction, avgPrice, qty, status, 'LIVE', realizedPnl, closedReason]
      );
      imported++;
    }

    return json(res, { message: 'Sync complete', imported, skipped, total: orders.length });
  } catch (e) {
    console.error('Bybit sync failed:', e);
    return json(res, { message: e.message, imported: 0 }, 500);
  }
}

// ── SSE event broadcast ──────────────────────────────────────────────────────
const sseClients = new Set();

function broadcast(event, data) {
  const line = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) { try { res.write(line); } catch (_) {} }
}

function startSSE(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
  res.on('close', () => sseClients.delete(res));
  sseClients.add(res);
  return res;
}

// ── analyze (single pair) ───────────────────────────────────────────────────
async function handleAnalyze(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const pair = (body.pair || 'BTCUSDT').toUpperCase();
  try {
    const { analyzeICT } = require('./ict-engine');
    const { fetchCandleSet } = require('./utils/binance');
    const { htf, ltf, d1 } = await fetchCandleSet(pair);
    const signal = await analyzeICT({ htfCandles: htf, ltfCandles: ltf, d1Candles: d1, pair });
    try {
      await runSQL(
        'INSERT INTO signals (pair, direction, details) VALUES ($1,$2,$3)',
        [pair, signal.direction, JSON.stringify(signal, null, 2)]
      );
    } catch (_) {}
    return json(res, signal);
  } catch (e) {
    console.error(`analyze ${pair} failed:`, e);
    return json(res, { message: e.message }, 500);
  }
}

// ── diary (single pair) ─────────────────────────────────────────────────────
async function handleDiary(req, res) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const body = JSON.parse(Buffer.concat(chunks).toString());
  const pair = (body.pair || 'BTCUSDT').toUpperCase();
  try {
    const { analyzeICT } = require('./ict-engine');
    const { buildDiary } = require('./modules/diary');
    const { fetchCandleSet } = require('./utils/binance');
    const { htf, ltf, d1 } = await fetchCandleSet(pair);
    const signal = await analyzeICT({ htfCandles: htf, ltfCandles: ltf, d1Candles: d1, pair });
    const diary = buildDiary(signal, { returnStruct: false });
    try {
      const diaryText = typeof diary === 'string' ? diary : JSON.stringify(diary);
      await runSQL('INSERT INTO diaries (pair, diary) VALUES ($1,$2) ON CONFLICT DO NOTHING', [pair, diaryText]);
    } catch (_) {}
    return json(res, { ok: true, diary });
  } catch (e) {
    console.error(`diary ${pair} failed:`, e);
    return json(res, { message: e.message }, 500);
  }
}

// ── analyze-all ──────────────────────────────────────────────────────────────
let analyzeLock = false;

async function analyzeAll(req, res) {
  if (analyzeLock) return json(res, { message: 'already running' }, 409);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  let body = {};
  try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch (_) {}

  const pairs = body.pairs || DEFAULT_PAIRS.map(p => p.symbol);
  analyzeLock = true;
  broadcast('analyze-start', { pairs, timestamp: new Date().toISOString() });

  const results = [];
  for (const pair of pairs) {
    try {
      const { analyzeICT } = require('./ict-engine');
      const { fetchCandleSet } = require('./utils/binance');
      const { htf, ltf, d1 } = await fetchCandleSet(pair);
      const result = await analyzeICT({ htfCandles: htf, ltfCandles: ltf, d1Candles: d1, pair });
      try {
        await runSQL(
          'INSERT INTO signals (pair, direction, details) VALUES ($1,$2,$3)',
          [pair, result.direction, JSON.stringify(result, null, 2)]
        );
      } catch (_) {}
      broadcast('analyze-done', { pair, ok: true, result });
      results.push({ pair, ok: true });
    } catch (e) {
      broadcast('analyze-done', { pair, ok: false, error: e.message });
      results.push({ pair, ok: false, error: e.message });
    }
  }

  analyzeLock = false;
  broadcast('analyze-complete', { total: results.length, timestamp: new Date().toISOString() });
  json(res, { results });
}

// ── ensure tables ────────────────────────────────────────────────────────────
async function ensureTables() {
  await runSQL(`CREATE TABLE IF NOT EXISTS trades (
    id TEXT PRIMARY KEY, pair TEXT NOT NULL, direction TEXT NOT NULL,
    entry_price NUMERIC, entry_filled NUMERIC, qty NUMERIC,
    tp_price NUMERIC, tp_filled NUMERIC, realized_pnl NUMERIC,
    status TEXT DEFAULT 'open', mode TEXT DEFAULT 'LIVE',
    exchange TEXT DEFAULT 'bybit', closed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(), closed_reason TEXT,
    leverage NUMERIC, sl TEXT, data JSONB
  );`);

  await runSQL(`CREATE TABLE IF NOT EXISTS pairs_config (
    pair TEXT PRIMARY KEY, exchange TEXT NOT NULL DEFAULT 'binance',
    chart_source TEXT NOT NULL DEFAULT 'binance',
    skip_on_error BOOLEAN DEFAULT FALSE, sort_order INTEGER DEFAULT 0
  );`);

  const { rows: existing } = await runSQL('SELECT COUNT(*) as cnt FROM pairs_config');
  if (existing[0].cnt === 0) {
    for (const p of DEFAULT_PAIRS) {
      await runSQL(
        'INSERT INTO pairs_config (pair, exchange, chart_source, skip_on_error, sort_order) VALUES ($1,$2,$3,$4,$5)',
        [p.symbol, p.exchange, p.chartSource, p.skipOnError, 0]
      );
    }
  }

  await runSQL(`CREATE TABLE IF NOT EXISTS dashboard_config (
    id INTEGER PRIMARY KEY CHECK (id = 1), mode TEXT DEFAULT 'DRY-RUN'
  );`);
  const { rows: cfgRows } = await runSQL('SELECT COUNT(*) as cnt FROM dashboard_config');
  if (cfgRows[0].cnt === 0) {
    await runSQL('INSERT INTO dashboard_config (id, mode) VALUES (1, $1)', ['DRY-RUN']);
  }

  await runSQL(`CREATE TABLE IF NOT EXISTS signals (
    id SERIAL PRIMARY KEY, pair TEXT NOT NULL, direction TEXT NOT NULL,
    confidence NUMERIC, summary TEXT, details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_signals_pair_time ON signals(pair, created_at DESC);`);

  await runSQL(`CREATE TABLE IF NOT EXISTS diaries (
    id SERIAL PRIMARY KEY, pair TEXT NOT NULL, diary TEXT NOT NULL,
    level TEXT, timeframe TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_diaries_pair_time ON diaries(pair, created_at DESC);`);

  console.log('✅ All tables ready');
}

// ── router ───────────────────────────────────────────────────────────────────
const srv = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    const pathname = u.pathname;

    if (pathname === '/api/config') {
      if (req.method === 'GET') return json(res, await getConfig());
      if (req.method === 'PUT') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        return json(res, await updateConfig(JSON.parse(Buffer.concat(chunks).toString())));
      }
      return json(res, { error: 'method not allowed' }, 405);
    }

    if (pathname === '/api/pairs') {
      if (req.method === 'GET') return json(res, { pairs: await getPairs() });
      if (req.method === 'PUT' || req.method === 'POST') {
        const chunks = [];
        for await (const chunk of req) chunks.push(chunk);
        const body = JSON.parse(Buffer.concat(chunks).toString());
        if (body.pairs) { await upsertPairs(body.pairs); return json(res, { pairs: await getPairs() }); }
        return json(res, await getPairs());
      }
      return json(res, { pairs: await getPairs() });
    }

    if (pathname === '/api/latest-signal') {
      const pair = u.searchParams.get('pair');
      if (!pair) return json(res, { error: 'pair required' }, 400);
      const row = await getLatestSignal(pair);
      if (!row) return json(res, null, 404);
      let signal;
      try { signal = typeof row.details === 'string' ? JSON.parse(row.details) : (row.details || row); }
      catch (_) { signal = row; }
      return json(res, signal);
    }

    if (pathname === '/api/latest-diary') {
      const pair = u.searchParams.get('pair');
      if (!pair) return json(res, { error: 'pair required' }, 400);
      const diary = await getLatestDiary(pair);
      return json(res, { ok: !!diary, diary });
    }

    if (pathname === '/api/events') return startSSE(res);

    if (pathname === '/api/analyze' && req.method === 'POST') return handleAnalyze(req, res);
    if (pathname === '/api/diary' && req.method === 'POST') return handleDiary(req, res);
    if (pathname === '/api/analyze-all' && req.method === 'POST') return analyzeAll(req, res);
    if (pathname === '/api/sync' && req.method === 'POST') return syncFromBybit(req, res);

    if (pathname === '/api/trades') {
      const pair = u.searchParams.get('pair');
      let q = 'SELECT * FROM trades ORDER BY created_at DESC';
      const p = [];
      if (pair) { q = 'SELECT * FROM trades WHERE pair=$1 ORDER BY created_at DESC'; p.push(pair.toUpperCase()); }
      const { rows } = await runSQL(q, p);
      return json(res, rows);
    }

    if (pathname === '/api/stats') return json(res, await getStats());
    if (pathname === '/api/ledger') return json(res, await getLedger());

    json(res, { error: 'Not found' }, 404);
  } catch (e) {
    console.error('Server error:', e);
    json(res, { error: e.message }, 500);
  }
});

const PORT = process.env.PORT || 3210;

async function start() {
  await ensureTables();
  srv.listen(PORT, '0.0.0.0', () => console.log(`✅ Dashboard API on :${PORT}`));
}
start().catch(console.error);

process.on('SIGTERM', async () => { srv.close(); closeDB(); process.exit(0); });
