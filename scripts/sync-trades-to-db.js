'use strict';
const fs = require('fs');
const path = require('path');
const { runSQL, ensureTable } = require('./db-driver');

const LIVE = path.join(__dirname, '..', 'trades', 'live');
const STATE = path.join(__dirname, '..', 'scripts', '.sync-state.json');

function calcPnl(t) {
  if (t.realizedPnl != null) return t.realizedPnl;
  const e = t.entry?.filled || t.entry?.entryPrice || 0;
  const x = (t.tp?.[0]?.filledPrice || t.tp?.[0]?.price || 0);
  if (!e || !x) return null;
  const d = t.direction === 'SHORT' ? -1 : 1;
  const q = t.qty || 1;
  return Math.round(d * (x - e) * q * 100) / 100;
}

async function syncFile(fp, fn) {
  const t = JSON.parse(fs.readFileSync(fp, 'utf-8'));
  const id = fn.replace('.json', '');
  const pnl = calcPnl(t);
  await runSQL(`
    INSERT INTO trades (id,pair,direction,entry_price,entry_filled,qty,tp_price,tp_filled,realized_pnl,status,mode,exchange,closed_at,created_at,closed_reason,leverage,sl,data)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
    ON CONFLICT (id) DO UPDATE SET
      pair=EXCLUDED.pair,direction=EXCLUDED.direction,entry_price=EXCLUDED.entry_price,
      entry_filled=EXCLUDED.entry_filled,qty=EXCLUDED.qty,tp_price=EXCLUDED.tp_price,
      tp_filled=EXCLUDED.tp_filled,realized_pnl=EXCLUDED.realized_pnl,status=EXCLUDED.status,
      mode=EXCLUDED.mode,exchange=EXCLUDED.exchange,closed_at=EXCLUDED.closed_at,
      created_at=EXCLUDED.created_at,closed_reason=EXCLUDED.closed_reason,
      leverage=EXCLUDED.leverage,sl=EXCLUDED.sl,data=EXCLUDED.data
  `, [
    id,
    t.pair || t.symbol || '',
    t.direction || '',
    parseFloat(t.entry?.entryPrice || t.entry?.price || 0) || 0,
    parseFloat(t.entry?.filled || t.entry?.filledPrice || 0) || 0,
    parseFloat(t.qty || 0) || 0,
    parseFloat(t.tp?.[0]?.price || t.tp?.[0]?.filledPrice || 0) || 0,
    parseFloat(t.tp?.[0]?.filledPrice || t.tp?.[0]?.price || 0) || 0,
    pnl,
    t.status || 'closed',
    t.mode || 'LIVE',
    t.exchange || 'bybit',
    t.closedAt ? new Date(t.closedAt) : null,
    t.createdAt ? new Date(t.createdAt) : new Date(),
    t.closedReason || t.closed_reason || null,
    parseFloat(t.leverage || t.cfg?.risk?.leverage || 1) || 1,
    t.sl || null,
    t
  ]);
}

async function getState() {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf-8')); }
  catch { return { lastSynced: {} }; }
}
async function saveState(s) { fs.writeFileSync(STATE, JSON.stringify(s, null, 2)); }

async function getAll(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.json') && !f.endsWith('.tmp'));
}

async function main() {
  await ensureTable();
  const st = await getState();
  let n = 0;
  for (const dir of ['closed', 'open']) {
    const files = await getAll(path.join(LIVE, dir));
    for (const f of files) {
      const fp = path.join(LIVE, dir, f);
      const mt = fs.statSync(fp).mtimeMs;
      const id = f.replace('.json', '');
      if (st.lastSynced[id] !== mt) {
        await syncFile(fp, f);
        st.lastSynced[id] = mt;
        n++;
      }
    }
  }
  if (n > 0) { await saveState(st); console.log(`✅ Synced ${n} trades`); }
  else { console.log('✅ No changes'); }
}

main().catch(console.error);
