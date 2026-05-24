'use strict';

const { getExchange }                  = require('./exchanges/index');
const { openTrades, saveTrade, closeTrade } = require('./utils/trade-store');

let _reconciled = false;

/**
 * Called once per watcher cycle (after all pairs are processed).
 * - First call performs reconcile() against exchange.
 * - Every call checks open trades for TP fills and adjusts trailing SL.
 *
 * @param {object} cfg   - trader.json
 * @param {object} [deps]
 */
async function tick(cfg, deps = {}) {
  const {
    exchangeFn = getExchange,
    nowFn      = () => new Date().toISOString(),
    env        = process.env,
  } = deps;

  const isLive = cfg.mode === 'live' && env.TRADING_LIVE === '1';
  const exchangeName = cfg.execution?.exchange ?? cfg.exchange?.default ?? 'binance';

  // Skip entirely in dry-run (nothing to poll)
  if (!isLive) return;

  let exchange;
  try {
    exchange = exchangeFn(exchangeName, cfg);
  } catch (err) {
    console.warn(`[position-monitor] exchange init failed: ${err.message}`);
    return;
  }

  if (!_reconciled && cfg.reconcile?.onStartup !== false) {
    try {
      await _reconcile(exchange, cfg, nowFn);
    } catch (err) {
      console.warn(`[position-monitor] reconcile error: ${err.message}`);
    }
    _reconciled = true;
  }

  // Cancel unfilled GTC limit orders first
  var uncancelCfg2 = cfg.uncancel || {};
  if (uncancelCfg2.breachPct || uncancelCfg2.maxSignalAgeSec || cfg.execution && cfg.execution.gtcTimeoutSec) {
    try {
      var cancelledCount = await cancelUnfilledOrders(exchange, cfg, nowFn);
      if (cancelledCount > 0) {
        console.log('[position-monitor] cancelled ' + cancelledCount + ' unfilled GTC limit order(s)');
      }
    } catch (err) {
      console.warn('[position-monitor] cancelUnfilledOrders error: ' + err.message);
    }
  }

  const trades = openTrades();
  for (const trade of trades) {
    try {
      await _checkTrade(trade, exchange, cfg, nowFn);
    } catch (err) {
      console.warn(`[position-monitor] ${trade.pair} check failed: ${err.message}`);
    }
  }
}


/**
 * Cancel unfilled GTC limit orders that match any of:
 *  1. POI breach — current price moved past POI + breachPct
 *  2. Signal stale — signal last_update exceeded maxSignalAgeSec
 *  3. GTC timeout — unfilled > gtcTimeoutSec
 */
async function cancelUnfilledOrders(exchange, cfg, nowFn) {
  var uncancelCfg = cfg.uncancel || {};
  var breachPct = uncancelCfg.breachPct || 0.03;
  var maxAgeSec = uncancelCfg.maxSignalAgeSec || 7200;
  var gtcSec    = (cfg.execution && cfg.execution.gtcTimeoutSec) || 3600;

  var openTradesList = openTrades();
  var cancelled = 0;

  for (var ti = 0; ti < openTradesList.length; ti++) {
    var trade = openTradesList[ti];
    if (trade.status !== 'unfilled') continue;
    if (!trade.entry || trade.entry.fillMethod !== 'limit') continue;
    if (!trade.entry.orderId) continue;

    var signal = trade.signal;
    if (!signal || !signal.entry) continue;

    var poi = signal.entry.price;
    var unfilledAt = trade.entry.unfilledAt;
    if (!unfilledAt) continue;

    var ageSec = (new Date(nowFn()) - new Date(unfilledAt)) / 1000;

    // Get current mark price
    var currentPrice;
    try {
      var ticker = await exchange.getTicker(trade.pair);
      currentPrice = ticker.markPrice || ticker.lastPrice || 0;
    } catch (err) {
      console.warn('[position-monitor] cancel: ' + trade.pair + ' ticker fetch failed: ' + err.message);
      continue;
    }
    if (!currentPrice || currentPrice <= 0) continue;

    // Check POI breach
    var reason = null;
    var direction = signal.direction;
    if (direction === 'long') {
      var deviation = (currentPrice - poi) / poi;
      if (deviation >= breachPct) reason = 'poi_breach';
    } else {
      var deviation2 = (poi - currentPrice) / poi;
      if (deviation2 >= breachPct) reason = 'poi_breach';
    }

    // Check signal staleness
    if (!reason && signal.lastUpdate) {
      var sigAge = (new Date(nowFn()) - new Date(signal.lastUpdate)) / 1000;
      if (sigAge > maxAgeSec) reason = 'signal_stale';
    }

    // Check GTC timeout
    if (!reason && ageSec >= gtcSec) reason = 'gtc_timeout';

    if (reason) {
      try {
        await exchange.cancelOrder(trade.pair, trade.entry.orderId);
        console.log('[position-monitor] cancelled ' + trade.pair + ' limit order (' + reason + ') — ' + trade.entry.orderId);
      } catch (err) {
        console.warn('[position-monitor] cancel failed for ' + trade.pair + ': ' + err.message);
      }
      trade.status = 'cancelled';
      trade.closedAt = nowFn();
      trade.closedReason = reason;
      trade.uncancelReason = reason;
      trade.uncancelPrice = currentPrice;
      trade.uncancelPoi = poi;
      trade.uncancelAgeSec = Math.round(ageSec);
      saveTrade(trade);
      cancelled++;
    }
  }

  return cancelled;
}

// ── Per-trade check ───────────────────────────────────────────────────────

async function _checkTrade(trade, exchange, cfg, nowFn) {
  const pos = await exchange.getPosition(trade.pair);

  // Position gone — all closed (TP3 or SL hit or manual)
  if (pos.size === 0 || pos.side === null) {
    trade.status      = 'closed';
    trade.closedAt    = nowFn();
    trade.closedReason = 'position_closed';
    // Try to derive PnL from fills if available
    closeTrade(trade);
    return;
  }

  // Check each TP for fill by querying open orders
  const openOrders = await exchange.getOpenOrders(trade.pair);
  const openOrderIds = new Set(openOrders.map(o => String(o.orderId)));

  let tpFilled = false;
  for (const tp of trade.tp) {
    if (tp.status !== 'pending' || !tp.orderId) continue;
    if (!openOrderIds.has(String(tp.orderId))) {
      // Order no longer open → assumed filled
      tp.status      = 'filled';
      tp.filledAt    = nowFn();
      tp.filledPrice = tp.price;  // best estimate; actual fill price via order history
      tpFilled = true;
    }
  }

  if (!tpFilled) return;

  // Trailing SL logic (after brief delay for fill confirmation)
  await _sleep(cfg.trailing?.moveOnFillConfirmDelayMs ?? 1500);

  const tp1 = trade.tp[0];
  const tp2 = trade.tp[1];
  const trailing = cfg.trailing ?? {};

  if (trailing.tp2ToTP1 && tp2?.status === 'filled' && tp1?.status === 'filled') {
    // Both TP1 and TP2 filled — move SL to TP1 price
    await _moveSL(trade, exchange, cfg, tp1.price, 'tp2_filled_sl_to_tp1', nowFn);
  } else if (trailing.tp1ToBE && tp1?.status === 'filled') {
    // TP1 filled — move SL to entry (breakeven)
    const bePrice = trade.entry.filled ?? trade.entry.requested;
    await _moveSL(trade, exchange, cfg, bePrice, 'tp1_filled_sl_to_be', nowFn);
  }

  saveTrade(trade);
}

async function _moveSL(trade, exchange, cfg, newPrice, reason, nowFn) {
  if (!trade.sl.orderId) return;
  const closeSide = trade.direction === 'LONG' ? 'SELL' : 'BUY';

  // Remaining qty = full qty - filled TP qtys
  const filledQty = trade.tp.filter(t => t.status === 'filled').reduce((s, t) => s + (t.qty ?? 0), 0);
  const remainQty = parseFloat((trade.qty - filledQty).toFixed(8));
  if (remainQty <= 0) return;

  const prevPrice = trade.sl.price;
  try {
    await exchange.cancelOrder(trade.pair, trade.sl.orderId);
  } catch (err) {
    // If already cancelled/filled, just continue
    console.warn(`[position-monitor] cancel SL failed (${err.message}) — placing new anyway`);
  }

  let newOrderId = null;
  for (let attempt = 1; attempt <= (cfg.retry?.orderMaxAttempts ?? 3); attempt++) {
    try {
      const { orderId } = await exchange.placeStopMarket(trade.pair, closeSide, newPrice, remainQty);
      newOrderId = orderId;
      break;
    } catch (err) {
      const delays = cfg.retry?.backoffMs ?? [250, 750, 2000];
      if (attempt < delays.length + 1) await _sleep(delays[attempt - 1]);
    }
  }

  trade.sl.price   = newPrice;
  trade.sl.orderId = newOrderId;
  trade.slMoves.push({ at: nowFn(), fromPrice: prevPrice, toPrice: newPrice, reason });
}

// ── Reconcile ─────────────────────────────────────────────────────────────

async function _reconcile(exchange, cfg, nowFn) {
  const trades = openTrades();
  if (trades.length === 0) return;

  for (const trade of trades) {
    try {
      const pos = await exchange.getPosition(trade.pair);
      if (pos.size === 0 || pos.side === null) {
        // File says open but exchange says closed
        trade.status       = 'closed';
        trade.closedAt     = nowFn();
        trade.closedReason = 'reconciled_missing';
        closeTrade(trade);
        console.warn(`[position-monitor] reconcile: ${trade.pair} ${trade.id} marked closed (not found on exchange)`);
      }
    } catch (err) {
      console.warn(`[position-monitor] reconcile ${trade.pair}: ${err.message}`);
    }
  }

  // adoptOrphans=false: we only log positions on exchange without a local record
  if (cfg.reconcile?.adoptOrphans !== true) return;
  // (adoptOrphans=true logic would go here — not implemented per plan decision)
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// Allow resetting reconcile flag in tests
function _resetReconcileFlag() { _reconciled = false; }

module.exports = { tick, _resetReconcileFlag };
