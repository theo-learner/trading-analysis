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
function formatTradeRow(t) {
  return {
    id: t.id, pair: t.pair, direction: t.direction,
    entry: { filled: t.entry_filled, price: t.entry_price },
    tp: [{ filledPrice: t.tp_filled, price: t.tp_price }],
    realizedPnl: t.realized_pnl, status: t.status, mode: t.mode,
    exchange: t.exchange,
    closedAt: t.closed_at, createdAt: t.created_at,
    closedReason: t.closed_reason, leverage: t.leverage, sl: t.sl,
  };
}

async function getLedger() {
  // closed_at 기준 정렬 — orphan 레코드(closed_at 없음)는 최하단
  const { rows: trades } = await runSQL(
    `SELECT * FROM trades ORDER BY closed_at DESC NULLS LAST, created_at DESC`
  );
  const closedRows = trades.filter(t => t.status === 'closed');
  const openRows   = trades.filter(t => t.status === 'open');
  // 통계는 실제 PnL 데이터가 있는 레코드만 (orphan 제외)
  const validClosed = closedRows.filter(t => t.closed_at !== null);
  const total    = validClosed.length;
  const wins     = validClosed.filter(t => parseFloat(t.realized_pnl) > 0).length;
  const losses   = validClosed.filter(t => parseFloat(t.realized_pnl) <= 0).length;
  const totalPnL = Math.round(validClosed.reduce((s, t) => s + (parseFloat(t.realized_pnl) || 0), 0) * 100) / 100;
  const avgPnL   = total > 0 ? Math.round((totalPnL / total) * 100) / 100 : 0;
  const winRate  = total > 0 ? Math.round((wins / total) * 10000) / 100 : 0;
  return {
    closed: closedRows.map(formatTradeRow),
    open:   openRows.map(formatTradeRow),
    stats: {
      total, totalTrades: total,
      wins, losses, winRate,
      totalPnL, totalPnl: totalPnL,
      avgPnL,   avgPnl:   avgPnL,
    },
  };
}

async function getStats() {
  const l = await getLedger();
  return { closed: l.closed.length, stats: l.stats };
}

// ── Sync from Bybit ───────────────────────────────────────────────────────────
async function syncFromBybit(req, res) {
  try {
    const apiKey    = process.env.BYBIT_API_KEY;
    const apiSecret = process.env.BYBIT_API_SECRET;
    if (!apiKey || !apiSecret) {
      return json(res, { message: 'Bybit API credentials not configured', imported: 0 }, 500);
    }

    const crypto = require('crypto');
    function bybitSign(qs) {
      const ts = Date.now().toString();
      const recvWindow = '5000';
      const sig = crypto.createHmac('sha256', apiSecret)
        .update(`${ts}${apiKey}${recvWindow}${qs}`).digest('hex');
      return { ts, recvWindow, sig };
    }

    async function bybitFetch(path, qs) {
      const { ts, recvWindow, sig } = bybitSign(qs);
      const resp = await fetch(`https://api.bybit.com${path}?${qs}`, {
        signal: AbortSignal.timeout(10_000),
        headers: {
          'Content-Type': 'application/json',
          'X-BAPI-API-KEY': apiKey,
          'X-BAPI-TIMESTAMP': ts,
          'X-BAPI-SIGN': sig,
          'X-BAPI-RECV-WINDOW': recvWindow,
        },
      });
      if (!resp.ok) throw new Error(`Bybit ${path}: HTTP ${resp.status}`);
      const d = await resp.json();
      if (d.retCode !== 0) throw new Error(`Bybit ${path}: ${d.retMsg}`);
      return d.result?.list || [];
    }

    // ── 1. Closed positions (진입가 / 청산가 / 실현 PnL 포함) ───────────────
    const closedList = await bybitFetch('/v5/position/closed-pnl', 'category=linear&limit=100');
    let closedUpserted = 0;

    for (const p of closedList) {
      if (!p.orderId) continue;
      const direction   = p.side === 'Buy' ? 'LONG' : 'SHORT';
      const entryPrice  = parseFloat(p.avgEntryPrice || 0);
      const exitPrice   = parseFloat(p.avgExitPrice  || 0);
      const pnl         = parseFloat(p.closedPnl     || 0);
      const qty         = parseFloat(p.qty            || 0);
      const leverage    = parseFloat(p.leverage       || 1);
      const closedAt    = p.updatedTime ? new Date(parseInt(p.updatedTime)).toISOString() : null;
      const createdAt   = p.createdTime ? new Date(parseInt(p.createdTime)).toISOString() : null;
      const closedReason = pnl > 0 ? 'TP' : 'SL';

      await runSQL(
        `INSERT INTO trades
           (id, pair, direction, entry_price, tp_price, qty, leverage,
            realized_pnl, status, mode, exchange, closed_at, created_at, closed_reason)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'closed','LIVE','bybit',$9,$10,$11)
         ON CONFLICT (id) DO UPDATE SET
           entry_price  = EXCLUDED.entry_price,
           tp_price     = EXCLUDED.tp_price,
           realized_pnl = EXCLUDED.realized_pnl,
           leverage     = EXCLUDED.leverage,
           status       = 'closed',
           closed_at    = EXCLUDED.closed_at,
           closed_reason = EXCLUDED.closed_reason`,
        [p.orderId, p.symbol, direction, entryPrice, exitPrice, qty, leverage,
         pnl, closedAt, createdAt, closedReason]
      );
      closedUpserted++;
    }

    // ── 2. Open positions (현재 실시간 포지션으로 교체) ──────────────────────
    await runSQL(`DELETE FROM trades WHERE status='open' AND exchange='bybit'`);

    const openList = await bybitFetch('/v5/position/list', 'category=linear&settleCoin=USDT');
    let openImported = 0;

    for (const p of openList) {
      if (!p.symbol || parseFloat(p.size || 0) === 0) continue;
      const id         = `bybit_open_${p.symbol}_${p.side}`;
      const direction  = p.side === 'Buy' ? 'LONG' : 'SHORT';
      const entryPrice = parseFloat(p.avgPrice      || 0);
      const unrealPnl  = parseFloat(p.unrealisedPnl || 0);
      const qty        = parseFloat(p.size          || 0);
      const leverage   = parseFloat(p.leverage      || 1);

      await runSQL(
        `INSERT INTO trades
           (id, pair, direction, entry_price, qty, leverage, realized_pnl, status, mode, exchange, created_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'open','LIVE','bybit',NOW())
         ON CONFLICT (id) DO UPDATE SET
           entry_price  = EXCLUDED.entry_price,
           qty          = EXCLUDED.qty,
           leverage     = EXCLUDED.leverage,
           realized_pnl = EXCLUDED.realized_pnl`,
        [id, p.symbol, direction, entryPrice, qty, leverage, unrealPnl]
      );
      openImported++;
    }

    return json(res, {
      message: 'Sync complete',
      closed: closedUpserted,
      open: openImported,
      total: closedList.length + openList.length,
    });
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
  const { analyzeICT } = require('./ict-engine');
  const { buildDiary } = require('./modules/diary');
  const { fetchCandleSet } = require('./utils/binance');

  for (const pair of pairs) {
    try {
      const { htf, ltf, d1 } = await fetchCandleSet(pair);
      const result = await analyzeICT({ htfCandles: htf, ltfCandles: ltf, d1Candles: d1, pair });
      try {
        await runSQL(
          'INSERT INTO signals (pair, direction, details) VALUES ($1,$2,$3)',
          [pair, result.direction, JSON.stringify(result, null, 2)]
        );
      } catch (_) {}
      let diary = null;
      try {
        diary = buildDiary(result, { returnStruct: false });
        const diaryText = typeof diary === 'string' ? diary : JSON.stringify(diary);
        await runSQL('INSERT INTO diaries (pair, diary) VALUES ($1,$2)', [pair, diaryText]);
      } catch (_) {}
      broadcast('analyze-done', { pair, ok: true, result, diary });
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
  );
  ALTER TABLE pairs_config ENABLE ROW LEVEL SECURITY;`);

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
  );
  ALTER TABLE dashboard_config ENABLE ROW LEVEL SECURITY;`);
  const { rows: cfgRows } = await runSQL('SELECT COUNT(*) as cnt FROM dashboard_config');
  if (cfgRows[0].cnt === 0) {
    await runSQL('INSERT INTO dashboard_config (id, mode) VALUES (1, $1)', ['DRY-RUN']);
  }

  await runSQL(`CREATE TABLE IF NOT EXISTS signals (
    id SERIAL PRIMARY KEY, pair TEXT NOT NULL, direction TEXT NOT NULL,
    confidence NUMERIC, summary TEXT, details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_signals_pair_time ON signals(pair, created_at DESC);
  ALTER TABLE signals ENABLE ROW LEVEL SECURITY;`);

  await runSQL(`CREATE TABLE IF NOT EXISTS diaries (
    id SERIAL PRIMARY KEY, pair TEXT NOT NULL, diary TEXT NOT NULL,
    level TEXT, timeframe TEXT, created_at TIMESTAMPTZ DEFAULT NOW()
  );
  CREATE INDEX IF NOT EXISTS idx_diaries_pair_time ON diaries(pair, created_at DESC);
  ALTER TABLE diaries ENABLE ROW LEVEL SECURITY;`);

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

    // Health check for Render
    if (pathname === '/health') return json(res, { status: 'ok' });

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
