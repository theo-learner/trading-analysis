'use strict';

const { normalizePair } = require('./utils/pair-config');

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
    for (const rawPair of traderConfig.pairs || []) {
      const pairCfg = normalizePair(rawPair);
      if (pairCfg.exchange !== 'binance') {
        logger.warn(`[watcher] ${pairCfg.symbol}: exchange '${pairCfg.exchange}' 미지원, skip`);
        continue;
      }
      try {
        const candles = await fetchCandleSet(pairCfg.symbol);
        const signal = analyzeICT({
          htfCandles: candles.htf,
          ltfCandles: candles.ltf,
          d1Candles:  candles.d1,
          pair:       pairCfg.symbol,
          config:     ictConfig,
        });
        const result = await notifySignal(signal, traderConfig);
        const sig = `${signal.direction} | Tier${signal.tier} | ${signal.confidence} | RR ${signal.rr?.toFixed(2) ?? '?'} | kz:${signal.entry?.killzone ?? 'none'}`;
        const outcome = result.sent ? '✅ SENT' : `⏭ ${result.skipped}${result.reason ? ' — ' + result.reason : ''}`;
        logger.log(`[watcher] ${pairCfg.symbol}: ${sig} → ${outcome}`);
      } catch (err) {
        logger.warn(`[watcher] ${pairCfg.symbol} failed: ${err.message}`);
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
  const INTERVAL_MS = 60_000;

  (async function loop() {
    while (true) {
      const start = Date.now();
      try {
        await run();
      } catch (e) {
        console.error('[watcher] cycle error:', e.message);
      }
      const wait = Math.max(0, INTERVAL_MS - (Date.now() - start));
      await new Promise(r => setTimeout(r, wait));
    }
  })();
}

module.exports = { run };
