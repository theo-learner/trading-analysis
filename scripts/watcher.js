'use strict';

const { normalizePair } = require('./utils/pair-config');
const { dedupKey, entryPriceDedupKey, hasRecentNotification, recordNotification, ENTRY_PRICE_WINDOW_MS } = require('./utils/notification-ledger');
const { loadTradeEnv } = require('./utils/load-env');

function _mergeEnv(base, tenv) {
  const hasOverride = tenv.LEVERAGE || tenv.MARGIN_USD || tenv.NOTIONAL_USD;
  if (!hasOverride) return base;
  return {
    ...base,
    execution: {
      ...base.execution,
      ...(tenv.LEVERAGE     && { leverage:    parseInt(tenv.LEVERAGE, 10) }),
      ...(tenv.MARGIN_USD   && { marginUsd:   parseFloat(tenv.MARGIN_USD) }),
      ...(tenv.NOTIONAL_USD && { notionalUsd: parseFloat(tenv.NOTIONAL_USD) }),
    },
    position: {
      ...base.position,
      ...(tenv.LEVERAGE && { leverage: parseInt(tenv.LEVERAGE, 10) }),
    },
  };
}

async function run(deps = {}) {
  const {
    fetchCandleSet  = require('./utils/binance').fetchCandleSet,
    analyzeICT      = require('./ict-engine').analyzeICT,
    notifySignal    = require('./notify').notifySignal,
    judgeSignal     = require('./signal-judge').judgeSignal,
    tradeExecutor   = require('./trade-executor'),
    positionMonitor = require('./position-monitor'),
    traderConfig    = require('./config/trader.json'),
    ictConfig       = require('./config/ict-engine.json'),
    logger          = console,
    timeoutMs       = 45_000,
    env             = process.env,
  } = deps;

  // Hot-reload: apply sessions/trade.env overrides each tick (no pm2 restart needed)
  const cfg = _mergeEnv(traderConfig, loadTradeEnv());

  const isLive = cfg.mode === 'live' && env.TRADING_LIVE === '1';
  let cancelled = false;

  const work = (async () => {
    for (const rawPair of cfg.pairs || []) {
      if (cancelled) break;
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

        // Judge signal once here — result injected into notifySignal to avoid double call
        const verdict = judgeSignal(signal, cfg);
        const sig = `${signal.direction} | Tier${signal.tier} | ${signal.confidence} | RR ${signal.rr?.toFixed(2) ?? '?'} | kz:${signal.entry?.killzone ?? 'none'}`;

        // 1시간 이내 동일 진입가 dedup — trade + notification 모두 스킵
        if (verdict.approved && hasRecentNotification(entryPriceDedupKey(signal), ENTRY_PRICE_WINDOW_MS)) {
          logger.log(`[watcher] ${pairCfg.symbol}: ${sig} → ⏭ entry_price_dedup (1h)`);
          continue;
        }

        let tradeResult = null;
        const tradeKey = dedupKey(signal);
        if (verdict.approved && (isLive || cfg.mode === 'dry-run') && (!isLive || !hasRecentNotification(tradeKey))) {
          try {
            tradeResult = await tradeExecutor.execute(signal, verdict, cfg, { env });
            const modeTag = tradeResult?.dryRun ? '[dry-run]' : '[live]';
            logger.log(`[watcher] ${pairCfg.symbol}: trade ${modeTag} ${tradeResult.id} slippage=${tradeResult.entry?.slippageBps ?? 0}bps`);
          } catch (err) {
            logger.warn(`[watcher] ${pairCfg.symbol}: trade execute failed: ${err.message}`);
          }
        }

        // Only send Telegram if verdict.approved; rejected signals skip notifySignal entirely
        if (!verdict.approved) {
          logger.log(`[watcher] ${pairCfg.symbol}: ${sig} → ⏭ rejected — ${verdict.reason}`);
        } else {
          const result = await notifySignal(signal, cfg, { verdict, tradeResult, env });
          let outcome;
          if (result.sent) {
            outcome = '✅ SENT';
          } else if (result.skipped === 'error') {
            outcome = `⏭ error — ${result.error || 'unknown'}`;
          } else {
            outcome = `⏭ ${result.skipped}${result.reason ? ' — ' + result.reason : ''}`;
          }
          logger.log(`[watcher] ${pairCfg.symbol}: ${sig} → ${outcome}`);
          // 진입가 기반 dedup 기록 — 다음 1시간 내 동일 진입가 시그널 차단
          recordNotification(entryPriceDedupKey(signal), { pair: signal.pair, direction: signal.direction });
        }
      } catch (err) {
        logger.warn(`[watcher] ${pairCfg.symbol} failed: ${err.message}`);
      }
    }

    // Position monitor tick — runs after all pairs processed
    try {
      await positionMonitor.tick(cfg, { env });
    } catch (err) {
      logger.warn(`[watcher] position monitor tick failed: ${err.message}`);
    }
  })();

  let timer;
  const guard = new Promise((_, reject) => {
    timer = setTimeout(() => {
      cancelled = true;
      reject(new Error(`watcher run timeout (${timeoutMs}ms)`));
    }, timeoutMs);
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
