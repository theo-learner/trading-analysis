'use strict';

async function run(deps = {}) {
  const {
    fetchCandleSet = require('./utils/binance').fetchCandleSet,
    analyzeICT     = require('./ict-engine').analyzeICT,
    notifySignal   = require('./notify').notifySignal,
    traderConfig   = require('./config/trader.json'),
    ictConfig      = require('./config/ict-engine.json'),
    logger         = console,
    timeoutMs      = 45_000,
  } = deps;

  const work = (async () => {
    for (const pair of traderConfig.pairs || []) {
      try {
        const candles = await fetchCandleSet(pair);
        const signal = analyzeICT({
          htfCandles: candles.htf,
          ltfCandles: candles.ltf,
          d1Candles:  candles.d1,
          pair,
          config:     ictConfig,
        });
        const result = await notifySignal(signal, traderConfig);
        const sig = `${signal.direction} | Tier${signal.tier} | ${signal.confidence} | RR ${signal.rr?.toFixed(2) ?? '?'} | kz:${signal.entry?.killzone ?? 'none'}`;
        const outcome = result.sent ? '✅ SENT' : `⏭ ${result.skipped}${result.reason ? ' — ' + result.reason : ''}`;
        logger.log(`[watcher] ${pair}: ${sig} → ${outcome}`);
      } catch (err) {
        logger.warn(`[watcher] ${pair} failed: ${err.message}`);
      }
    }
  })();

  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`watcher run timeout (${timeoutMs}ms)`)),
      timeoutMs,
    );
  });
  try {
    await Promise.race([work, guard]);
  } finally {
    clearTimeout(timer);
  }
}

if (require.main === module) {
  run().catch((e) => {
    console.error('[watcher] fatal:', e.message);
    process.exit(1);
  });
}

module.exports = { run };
