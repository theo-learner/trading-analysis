#!/usr/bin/env node
'use strict';

// Live entry test for all 6 pairs — GTC limit entry
const { judgeSignal } = require('./scripts/signal-judge');
const tradeExecutor = require('./scripts/trade-executor');
const traderConfig = require('./scripts/config/trader.json');

var pairConfigs = [
  { symbol: 'BTCUSDT',  price: 76500, dir: 'LONG'  },
  { symbol: 'ETHUSDT',  price: 2094,  dir: 'LONG'  },
  { symbol: 'SOLUSDT',  price: 85.27, dir: 'LONG'  },
  { symbol: 'HYPEUSDT', price: 43.5,  dir: 'SHORT' },
  { symbol: 'ZECUSDT',  price: 649.3, dir: 'LONG'  },
  { symbol: 'MORPHOUSDT', price: 2.199, dir: 'LONG' },
];

process.env.TRADING_LIVE = '1';

function runPair(pc, idx) {
  return (async function() {
    console.log('\n═══════════════════════════════════');
    console.log(`TEST ${idx}/6: ${pc.symbol} ${pc.dir}`);
    console.log('═══════════════════════════════════\n');
    
    var price = pc.price;
    var slDist = price * 0.05;
    var tpDist = slDist * 2;
    
    var signal = {
      pair: pc.symbol,
      direction: pc.dir,
      tier: 1,
      confidence: 'HIGH',
      entry: { price: price, basis: 'POI_RETEST', killzone: 'Test' },
      sl: pc.dir === 'LONG' ? (price - slDist) : (price + slDist),
      tp: [pc.dir === 'LONG' ? (price + tpDist) : (price - tpDist)],
      rr: 2.0,
      currentPrice: price,
      scorecard: { sizeMultiplier: 1, grade: 'A' },
      tradeBlocked: false,
      structure: { htfTrend: pc.dir === 'LONG' ? 'bull' : 'bear', ltfTrend: pc.dir === 'LONG' ? 'bull' : 'bear' },
    };
    
    console.log(`  Entry: $${price} | SL: $${signal.sl.toFixed(4)} | TP: $${signal.tp[0].toFixed(4)} | RR: ${signal.rr}`);
    
    var verdict = judgeSignal(signal, traderConfig);
    if (!verdict.approved) {
      console.log(`  REJECTED: ${verdict.reason}`);
      return;
    }
    console.log(`  APPROVED`);
    
    try {
      var trade = await tradeExecutor.execute(signal, verdict, traderConfig, { env: process.env });
      console.log(`  ID: ${trade.id}`);
      console.log(`  Status: ${trade.status}`);
      console.log(`  Fill: ${trade.entry ? trade.entry.fillMethod : 'N/A'}`);
      console.log(`  Order: ${trade.entry ? trade.entry.orderId : 'N/A'}`);
      if (trade.entry && trade.entry.filled > 0) {
        console.log(`  Filled: $${trade.entry.filled.toFixed(6)}`);
      } else if (trade.entry && trade.entry.entryPrice) {
        console.log(`  Limit @ $${trade.entry.entryPrice} — ${trade.status}`);
      }
      if (trade.sl && trade.sl.price) console.log(`  SL: $${trade.sl.price}`);
      if (trade.tp && trade.tp[0] && trade.tp[0].price) console.log(`  TP: $${trade.tp[0].price.toFixed(6)}`);
      if (trade.errors && trade.errors.length) {
        console.log(`  Errors: ${trade.errors.map(function(e){return e.message;}).join(', ')}`);
      }
    } catch (err) {
      console.log(`  ERROR: ${err.message}`);
    }
    
    await new Promise(function(r) { setTimeout(r, 1000); });
  })();
}

(async function main() {
  console.log('LIVE ENTRY TEST — 6 PAIRS');
  for (var i = 0; i < pairConfigs.length; i++) {
    await runPair(pairConfigs[i], i + 1);
  }
  console.log('\n=== ALL TESTS COMPLETE ===\n');
  
  var store = require('./scripts/utils/trade-store');
  var open = store.openTrades();
  var closed = store.closedTrades();
  console.log(`Open: ${open.length} | Closed: ${closed.length}`);
})();
