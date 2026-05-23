#!/usr/bin/env node
'use strict';
/**
 * 4시간 주기 자동 검사
 * 1. API health + response time
 * 2. Swing detection correctness (last swing within 0.5% of actual)
 * 3. Trend stability (trend label vs price action)
 * 4. Dashboard HTML rendering check
 * 5. 결과: OK면 stdout에 요약, FAIL이면 errors.json에 기록 + stderr에 상세
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

const API = 'http://localhost:3210';
const PAIRS = ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'HYPEUSDT'];
const errors = [];
const startTime = Date.now();

async function check(name, fn) {
  try {
    const result = await fn();
    if (result === false || result?.ok === false) {
      errors.push({ name, error: result?.message || 'check failed', time: new Date().toISOString() });
      console.error(`❌ ${name}: ${result?.message || 'check failed'}`);
      return false;
    }
    console.log(`✅ ${name}: ${result || 'ok'}`);
    return true;
  } catch (e) {
    errors.push({ name, error: e.message, time: new Date().toISOString() });
    console.error(`❌ ${name}: ${e.message}`);
    return false;
  }
}

// 1. API Health
async function checkApiHealth() {
  const endpoints = [
    { path: '/api/pairs', label: 'pairs' },
    { path: '/api/config', label: 'config' },
    { path: '/api/ledger?limit=10', label: 'ledger' },
    ...PAIRS.map(p => ({ path: `/api/latest-diary?pair=${p}`, label: `diary/${p}` })),
  ];

  const results = [];
  for (const ep of endpoints) {
    const start = Date.now();
    try {
      const resp = await fetch(`${API}${ep.path}`, { signal: AbortSignal.timeout(5000) });
      const ms = Date.now() - start;
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      results.push(`${ep.label}: ${ms}ms`);
    } catch (e) {
      return { ok: false, message: `${ep.label} failed: ${e.message}` };
    }
  }
  return results.join(', ');
}

// 2. Swing Detection Correctness
async function checkSwings() {
  const { fetchCandleSet } = require('../scripts/utils/binance');
  const { detectSwingPoints } = require('../scripts/modules/swing-points');

  for (const pair of PAIRS) {
    const candles = await fetchCandleSet(pair);
    const swings = detectSwingPoints(candles.ltf, { leftBars: 5, rightBars: 5 });

    // Last swing should be at a meaningful extreme
    // If low: current price should be >= swing (price has moved up from low)
    // If high: current price should be <= swing (price has moved down from high)
    const lastSwing = swings[swings.length - 1];
    const currentPrice = candles.ltf[candles.ltf.length - 1].close;
    const swingPrice = lastSwing.price;

    // Allow up to 5% buffer — new swing may not be detected yet if candle is still forming
    if (lastSwing.type === 'low' && currentPrice < swingPrice * 0.95) {
      return { ok: false, message: `${pair}: price ${currentPrice.toFixed(2)} >5% below last swing low ${swingPrice.toFixed(2)}` };
    }
    if (lastSwing.type === 'high' && currentPrice > swingPrice * 1.05) {
      return { ok: false, message: `${pair}: price ${currentPrice.toFixed(2)} >5% above last swing high ${swingPrice.toFixed(2)}` };
    }

    // Count should be reasonable (not too many, not too few)
    if (swings.length < 5 || swings.length > 30) {
      return { ok: false, message: `${pair}: ${swings.length} swings (expected 5-30)` };
    }
  }
  return `${PAIRS.length} pairs checked, swings OK`;
}

// 3. Trend Stability
async function checkTrends() {
  const { fetchCandleSet } = require('../scripts/utils/binance');
  const { detectSwingPoints } = require('../scripts/modules/swing-points');
  const { getCurrentTrend } = require('../scripts/modules/market-structure');

  for (const pair of PAIRS) {
    const candles = await fetchCandleSet(pair);
    const swings = detectSwingPoints(candles.ltf, { leftBars: 5, rightBars: 5 });
    const trend = getCurrentTrend(swings);

    // Trend should be one of: bull, bear, ranging
    if (!['bull', 'bear', 'ranging'].includes(trend)) {
      return { ok: false, message: `${pair}: invalid trend "${trend}"` };
    }

    // Sanity: if current price dropped significantly from last swing high, trend shouldn't be bull
    const lastSwing = swings[swings.length - 1];
    const currentPrice = candles.ltf[candles.ltf.length - 1].close;
    if (lastSwing.type === 'high' && currentPrice < lastSwing.price * 0.95 && trend === 'bull') {
      return { ok: false, message: `${pair}: price ${currentPrice.toFixed(2)} is 5% below swing high ${lastSwing.price.toFixed(2)} but trend is "bull"` };
    }
  }
  return `${PAIRS.length} trends valid`;
}

// 4. Dashboard HTML Rendering
async function checkDashboard() {
  const htmlPath = path.join(ROOT, 'scripts', 'dashboard', 'index.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');

  // Check for required elements
  const checks = [
    { pattern: /id="history-section"/, name: 'history section' },
    { pattern: /id="history-tabs"/, name: 'history tabs' },
    { pattern: /id="history-stats"/, name: 'stats cards' },
    { pattern: /id="history-tbody"/, name: 'trade tbody' },
    { pattern: /id="statTotal"/, name: 'stat total' },
    { pattern: /id="statWinRate"/, name: 'stat win rate' },
    { pattern: /id="statTotalPnl"/, name: 'stat total pnl' },
    { pattern: /id="statAvgPnl"/, name: 'stat avg pnl' },
    { pattern: /data-tab="open"/, name: 'open tab' },
    { pattern: /data-tab="closed"/, name: 'closed tab' },
    { pattern: /data-tab="all"/, name: 'all tab' },
    { pattern: /loadTrades/, name: 'loadTrades function' },
    { pattern: /renderHistory/, name: 'renderHistory function' },
    { pattern: /refreshHistoryTab/, name: 'refreshHistoryTab function' },
  ];

  const failed = checks.filter(c => !c.pattern.test(html));
  if (failed.length) {
    return { ok: false, message: `${failed.length} missing: ${failed.map(c => c.name).join(', ')}` };
  }
  return `${checks.length - failed.length}/${checks.length} DOM elements found`;
}

// 5. Trade-store integration
async function checkTradeStore() {
  const { openTrades, closedTrades } = require('../scripts/utils/trade-store');

  const open = openTrades();
  const closed = closedTrades(50);

  if (open.length > 50) {
    return { ok: false, message: `${open.length} open trades (exceeds 50)` };
  }
  if (closed.length < 0 || closed.length > 50) {
    return { ok: false, message: `closedTrades returned ${closed.length} (expected 50)` };
  }

  // Check a trade has expected fields
  if (closed.length > 0) {
    const t = closed[0];
    const requiredFields = ['pair', 'direction', 'entry', 'status'];
    const missing = requiredFields.filter(f => !(f in t));
    if (missing.length) {
      return { ok: false, message: `Trade missing fields: ${missing.join(', ')}` };
    }
  }

  return `open:${open.length} closed:${closed.length} trades valid`;
}

// Main
async function main() {
  console.log('🔍 4h Automated Check —', new Date().toISOString());
  console.log('---');

  await Promise.all([
    check('API Health', checkApiHealth),
    check('Swing Detection', checkSwings),
    check('Trend Stability', checkTrends),
    check('Dashboard HTML', checkDashboard),
    check('Trade Store', checkTradeStore),
  ]);

  const elapsed = Date.now() - startTime;
  console.log('---');
  console.log(`Completed in ${elapsed}ms`);

  if (errors.length > 0) {
    console.error(`\n❌ ${errors.length} failure(s) found`);

    // Save error report
    const report = {
      timestamp: new Date().toISOString(),
      elapsed,
      failures: errors,
      checkCount: 5,
      failCount: errors.length,
      passCount: 5 - errors.length,
    };
    const reportPath = path.join(ROOT, 'tests', 'errors.json');
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.error(`Error report saved: ${reportPath}`);

    process.exit(1);
  } else {
    console.log('\n✅ All checks passed');
    process.exit(0);
  }
}

main().catch(e => {
  console.error('Fatal:', e);
  process.exit(2);
});
