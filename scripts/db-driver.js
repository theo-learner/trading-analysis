'use strict';
const { Client } = require('pg');
let client = null;

function parseDSN(dsn) {
  const url = new URL(dsn);
  return {
    host: url.hostname,
    port: parseInt(url.port, 10),
    user: url.username,
    password: url.password,
    database: url.pathname.slice(1),
  };
}

async function initDB() {
  if (client) return client;
  const dsn = parseDSN(process.env.DATABASE_URL);
  client = new Client({
    host: dsn.host,
    port: dsn.port,
    user: dsn.user,
    password: dsn.password,
    database: dsn.database,
    ssl: { rejectUnauthorized: false },
    family: 4,              // prefer IPv4
    lookup: (hostname, _opts, cb) => {
      // Force IPv4 lookup — bypass IPv6 DNS on Render free tier
      const dns = require('dns');
      dns.lookup(hostname, { family: 4 }, (err, address) => cb(err, address || hostname, 4));
    }
  });
  await client.connect();
  console.log('✅ Supabase connected');
  return client;
}

async function closeDB() {
  if (client) { client.end(); client = null; }
}

async function runSQL(sql, params = []) {
  const c = await initDB();
  return c.query(sql, params);
}

async function ensureTable() {
  await runSQL(`
    CREATE TABLE IF NOT EXISTS trades (
      id TEXT PRIMARY KEY,
      pair TEXT NOT NULL,
      direction TEXT NOT NULL,
      entry_price NUMERIC,
      entry_filled NUMERIC,
      qty NUMERIC,
      tp_price NUMERIC,
      tp_filled NUMERIC,
      realized_pnl NUMERIC,
      status TEXT DEFAULT 'open',
      mode TEXT DEFAULT 'LIVE',
      exchange TEXT DEFAULT 'bybit',
      closed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      closed_reason TEXT,
      leverage NUMERIC,
      sl TEXT,
      data JSONB
    );
    CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
    CREATE INDEX IF NOT EXISTS idx_trades_direction ON trades(direction);
    CREATE INDEX IF NOT EXISTS idx_trades_created ON trades(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_trades_pair ON trades(pair);
    ALTER TABLE trades ENABLE ROW LEVEL SECURITY;
  `);
  console.log('✅ Table ready');
}

module.exports = { initDB, closeDB, runSQL, ensureTable };
