'use strict';
const http = require('http');
const { runSQL, initDB, ensureTable } = require('./db-driver');

function json(res, d, s = 200) {
  res.writeHead(s, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify(d));
}

async function getLedger() {
  const { rows: trades } = await runSQL('SELECT * FROM trades ORDER BY created_at DESC');
  const closed = trades.filter(t => t.status === 'closed');
  const open = trades.filter(t => t.status === 'open');
  const total = closed.length;
  const wins = closed.filter(t => t.realized_pnl > 0).length;
  const losses = closed.filter(t => t.realized_pnl <= 0).length;
  const totalPnL = Math.round(closed.reduce((s,t) => s + (t.realized_pnl||0), 0)*100)/100;
  const avgPnL = total > 0 ? Math.round((totalPnL/total)*100)/100 : 0;
  const winRate = total > 0 ? Math.round((wins/total)*10000)/100 : 0;
  const formatted = closed.map(t => ({
    id:t.id, pair:t.pair, direction:t.direction,
    entry:{filled:t.entry_filled, price:t.entry_price},
    tp:[{filledPrice:t.tp_filled, price:t.tp_price}],
    realizedPnl:t.realized_pnl, status:t.status, mode:t.mode,
    closedAt:t.closed_at, createdAt:t.created_at,
    closedReason:t.closed_reason, leverage:t.leverage, sl:t.sl
  }));
  return { closed: formatted, open, stats:{total,wins,losses,winRate,totalPnL,avgPnL} };
}

async function getStats() {
  const l = await getLedger();
  return { closed: l.closed.length, stats: l.stats };
}

const srv = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  try {
    const u = new URL(req.url, `http://${req.headers.host}`);
    if (u.pathname === '/api/ledger') json(res, await getLedger());
    else if (u.pathname === '/api/stats') json(res, await getStats());
    else if (u.pathname === '/api/trades') {
      const pair = u.searchParams.get('pair');
      let q = 'SELECT * FROM trades ORDER BY created_at DESC';
      const p = [];
      if (pair) { q = 'SELECT * FROM trades WHERE pair=$1 ORDER BY created_at DESC'; p.push(pair.toUpperCase()); }
      const {rows} = await runSQL(q, p);
      json(res, rows);
    }
    else json(res, {error:'Not found'}, 404);
  } catch(e) { console.error(e); json(res, {error:e.message}, 500); }
});

const PORT = process.env.PORT || 3210;
async function start() {
  await ensureTable();
  srv.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Dashboard API on :${PORT}`);
  });
}
start().catch(console.error);
process.on('SIGTERM', async () => { srv.close(); require('./db-driver').closeDB(); process.exit(0); });
