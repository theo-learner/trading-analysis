'use strict';
const { Client } = require('pg');
let client = null;

async function initDB() {
  if (client) return client;
  client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
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
  `);
  console.log('✅ Table ready');
}

module.exports = { initDB, closeDB, runSQL, ensureTable };
