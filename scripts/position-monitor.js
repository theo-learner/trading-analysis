'use strict';

const { getExchange }                  = require('./exchanges/index');
const { openTrades, saveTrade, closeTrade } = require('./utils/trade-store');
const { calcPnl }                      = require('./utils/pnl-calc');

let _reconciled = false;

async function tick(cfg, deps) {
  deps = deps || {};
  var exchangeFn = deps.exchangeFn || getExchange;
  var nowFn      = deps.nowFn      || function() { return new Date().toISOString(); };
  var isLive = cfg.mode === 'live' && process.env.TRADING_LIVE === '1';
  var exchangeName = cfg.execution?.exchange ?? cfg.exchange?.default ?? 'binance';

  if (!isLive) return;

  var exchange;
  try {
    exchange = exchangeFn(exchangeName, cfg);
  } catch (err) {
    console.warn('[position-monitor] exchange init failed: ' + err.message);
    return;
  }

  // Startup reconcile
  if (!_reconciled && cfg.reconcile?.onStartup !== false) {
    try {
      await _reconcile(exchange, cfg, nowFn);
    } catch (err) {
      console.warn('[position-monitor] reconcile error: ' + err.message);
    }
    _reconciled = true;
  }

  // Cancel unfilled GTC limit orders
  var uncancelCfg = cfg.uncancel || {};
  if (uncancelCfg.breachPct || uncancelCfg.maxSignalAgeSec || (cfg.execution && cfg.execution.gtcTimeoutSec)) {
    try {
      var cancelledCount = await cancelUnfilledOrders(exchange, cfg, nowFn);
      if (cancelledCount > 0) {
        console.log('[position-monitor] cancelled ' + cancelledCount + ' unfilled GTC limit order(s)');
      }
    } catch (err) {
      console.warn('[position-monitor] cancelUnfilledOrders error: ' + err.message);
    }
  }

  // Check each open trade
  var trades = openTrades();
  for (var i = 0; i < trades.length; i++) {
    try {
      if (trades[i].status === 'unfilled') {
        await _checkUnfilledTrade(trades[i], exchange, cfg, nowFn);
      } else {
        await _checkTrade(trades[i], exchange, cfg, nowFn);
      }
    } catch (err) {
      console.warn('[position-monitor] ' + trades[i].pair + ' check failed: ' + err.message);
    }
  }
}

async function cancelUnfilledOrders(exchange, cfg, nowFn) {
  var uncancelCfg = cfg.uncancel || {};
  var breachPct = uncancelCfg.breachPct || 0.03;
  var maxAgeSec = uncancelCfg.maxSignalAgeSec || 7200;
  var gtcSec    = (cfg.execution && cfg.execution.gtcTimeoutSec) || 3600;
  var openList = openTrades();
  var cancelled = 0;

  for (var i = 0; i < openList.length; i++) {
    var trade = openList[i];
    if (trade.status !== 'unfilled') continue;
    if (!trade.entry || trade.entry.fillMethod !== 'limit') continue;
    if (!trade.entry.orderId) continue;
    var signal = trade.signal;
    if (!signal || !signal.entry) continue;

    var poi = signal.entry.price;
    var unfilledAt = trade.entry.unfilledAt;
    if (!unfilledAt) continue;

    var ageSec = (new Date(nowFn()) - new Date(unfilledAt)) / 1000;
    var currentPrice;
    try {
      currentPrice = await exchange.getMarkPrice(trade.pair);
    } catch (err) {
      console.warn('[position-monitor] cancel: ' + trade.pair + ' ticker fetch failed: ' + err.message);
      continue;
    }
    if (!currentPrice || currentPrice <= 0) continue;

    var reason = null;
    var dir = signal.direction;
    if (dir === 'long') {
      var dev = (currentPrice - poi) / poi;
      if (dev >= breachPct) reason = 'poi_breach';
    } else {
      var dev2 = (poi - currentPrice) / poi;
      if (dev2 >= breachPct) reason = 'poi_breach';
    }
    if (!reason && signal.lastUpdate) {
      var sigAge = (new Date(nowFn()) - new Date(signal.lastUpdate)) / 1000;
      if (sigAge > maxAgeSec) reason = 'signal_stale';
    }
    if (!reason && ageSec >= gtcSec) reason = 'gtc_timeout';

    if (reason) {
      try {
        await exchange.cancelOrder(trade.pair, trade.entry.orderId);
        console.log('[position-monitor] cancelled ' + trade.pair + ' limit order (' + reason + ')');
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
      closeTrade(trade);  // moves from OPEN_DIR to CLOSED_DIR
      cancelled++;
    }
  }
  return cancelled;
}

// ── Unfilled limit order fill detection ──────────────────────────────────

async function _checkUnfilledTrade(trade, exchange, cfg, nowFn) {
  // Detect if the GTC limit order has since filled by checking for an open position
  var pos;
  try {
    pos = await exchange.getPosition(trade.pair);
  } catch (err) {
    console.warn('[position-monitor] unfilled check getPosition failed for ' + trade.pair + ': ' + err.message);
    return;
  }

  if (pos.size === 0 || pos.side === null) {
    // No position — check if the limit order was externally cancelled
    if (trade.entry.orderId) {
      var openOrders;
      try {
        openOrders = await exchange.getOpenOrders(trade.pair);
      } catch (_e) {
        return;  // can't determine order status — leave for next tick
      }
      var orderStillOpen = openOrders.some(function(o) {
        return String(o.orderId) === String(trade.entry.orderId);
      });
      if (!orderStillOpen) {
        // Order gone and no position — externally cancelled
        trade.status      = 'cancelled';
        trade.closedAt    = nowFn();
        trade.closedReason = 'externally_cancelled';
        closeTrade(trade);
        console.log('[position-monitor] ' + trade.pair + ' unfilled order externally cancelled — cleaned up');
      }
    }
    return;
  }

  // Position exists — limit order filled; place SL/TP now
  console.log('[position-monitor] ' + trade.pair + ' unfilled limit order filled — placing SL/TP');

  trade.entry.filled      = pos.entryPrice || trade.entry.requested;
  trade.entry.confirmedAt = nowFn();
  if (trade.entry.requested && trade.entry.filled) {
    trade.entry.slippageBps = parseFloat(
      (Math.abs(trade.entry.filled - trade.entry.requested) / trade.entry.requested * 10000).toFixed(2)
    );
  }
  trade.qty    = pos.size;
  trade.status = 'open';
  saveTrade(trade);

  var closeSide = trade.direction === 'LONG' ? 'SELL' : 'BUY';

  // SL placement
  var slPlaced = false;
  if (trade.sl && trade.sl.price > 0) {
    var maxAttempts = (cfg.retry && cfg.retry.orderMaxAttempts) || 3;
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
      trade.sl.placementAttempts = (trade.sl.placementAttempts || 0) + 1;
      try {
        await exchange.placeStopMarket(trade.pair, closeSide, trade.sl.price, trade.qty);
        await _sleep(500);
        var posCheck = await exchange.getPosition(trade.pair);
        if (posCheck.stopLoss) {
          slPlaced = true;
          trade.sl.orderId = 'sl_trading-stop';
          break;
        }
      } catch (err) {
        trade.errors.push({ at: nowFn(), stage: 'sl_attempt_' + attempt + '_postfill', message: err.message });
        var delays = (cfg.retry && cfg.retry.backoffMs) || [250, 750, 2000];
        if (attempt < delays.length) await _sleep(delays[attempt - 1]);
      }
    }
  }

  if (!slPlaced) {
    trade.errors.push({ at: nowFn(), stage: 'sl_failed_postfill', message: 'SL exhausted after delayed fill — emergency close' });
    try {
      await exchange.closePosition(trade.pair, trade.direction);
    } catch (closeErr) {
      trade.errors.push({ at: nowFn(), stage: 'emergency_close', message: closeErr.message });
    }
    trade.status      = 'closed';
    trade.closedAt    = nowFn();
    trade.closedReason = 'sl_placement_failed_postfill';
    saveTrade(trade);
    return;
  }

  // TP placement
  var tpPrice = trade.tp && trade.tp[0] && trade.tp[0].price;
  if (tpPrice > 0) {
    try {
      await exchange.placeTakeProfitMarket(trade.pair, closeSide, tpPrice, trade.qty);
      trade.tp[0].orderId = 'tp_trading-stop';
      trade.tp[0].qty = trade.qty;
    } catch (err) {
      trade.errors.push({ at: nowFn(), stage: 'tp_postfill', message: err.message });
    }
  }

  saveTrade(trade);
}

// ── Per-trade check ──────────────────────────────────────────────────────

async function _checkTrade(trade, exchange, cfg, nowFn) {
  var pos = await exchange.getPosition(trade.pair);

  // Position gone
  if (pos.size === 0 || pos.side === null) {
    trade.status      = 'closed';
    trade.closedAt    = nowFn();
    trade.closedReason = 'position_closed';

    // Calculate PnL
    await _calcPnl(trade, exchange, nowFn);
    closeTrade(trade);
    return;
  }

  // Check TP fills
  var openOrders;
  try {
    openOrders = await exchange.getOpenOrders(trade.pair);
  } catch (err) {
    console.warn('[position-monitor] getOpenOrders failed for ' + trade.pair + ': ' + err.message);
    return;
  }
  var openIds = new Set();
  for (var i = 0; i < openOrders.length; i++) openIds.add(String(openOrders[i].orderId));

  // Position-level TP/SL set via /v5/position/trading-stop use a virtual ID
  // and never appear in /v5/order/realtime — skip open-order-based detection for them.
  var VIRTUAL_ORDER_IDS = new Set(['tp_trading-stop', 'sl_trading-stop']);

  var tpFilled = false;
  for (var j = 0; j < trade.tp.length; j++) {
    var tp = trade.tp[j];
    if (tp.status !== 'pending' || !tp.orderId) continue;
    if (VIRTUAL_ORDER_IDS.has(String(tp.orderId))) continue;
    if (!openIds.has(String(tp.orderId))) {
      tp.status      = 'filled';
      tp.filledAt    = nowFn();
      tp.filledPrice = tp.price;
      tpFilled = true;
    }
  }
  if (!tpFilled) return;

  // Trailing SL
  if (cfg.trailing) {
    await _sleep(cfg.trailing.moveOnFillConfirmDelayMs || 1500);
    var trailing = cfg.trailing;
    if (trailing.tp2ToTP1 && trade.tp[1]?.status === 'filled' && trade.tp[0]?.status === 'filled') {
      await _moveSL(trade, exchange, cfg, trade.tp[0].price, 'tp2_filled_sl_to_tp1', nowFn);
    } else if (trailing.tp1ToBE && trade.tp[0]?.status === 'filled') {
      var bePrice = trade.entry.filled ?? trade.entry.requested;
      await _moveSL(trade, exchange, cfg, bePrice, 'tp1_filled_sl_to_be', nowFn);
    }
  }

  saveTrade(trade);
}

async function _moveSL(trade, exchange, cfg, newPrice, reason, nowFn) {
  if (!trade.sl.orderId) return;
  var closeSide = trade.direction === 'LONG' ? 'SELL' : 'BUY';
  var filledQty = 0;
  for (var i = 0; i < trade.tp.length; i++) {
    if (trade.tp[i].status === 'filled') filledQty += (trade.tp[i].qty || 0);
  }
  var remainQty = parseFloat((trade.qty - filledQty).toFixed(8));
  if (remainQty <= 0) return;

  var prevPrice = trade.sl.price;
  try {
    await exchange.cancelOrder(trade.pair, trade.sl.orderId);
  } catch (err) {
    console.warn('[position-monitor] cancel SL failed (' + err.message + ')');
  }

  var newOrderId = null;
  var maxAttempts = (cfg.retry && cfg.retry.orderMaxAttempts) || 3;
  for (var i = 1; i <= maxAttempts; i++) {
    try {
      var result = await exchange.placeStopMarket(trade.pair, closeSide, newPrice, remainQty);
      newOrderId = result.orderId;
      break;
    } catch (err) {
      var delays = (cfg.retry && cfg.retry.backoffMs) || [250, 750, 2000];
      if (i < delays.length) await _sleep(delays[i - 1]);
    }
  }

  trade.sl.price   = newPrice;
  trade.sl.orderId = newOrderId;
  trade.slMoves.push({ at: nowFn(), fromPrice: prevPrice, toPrice: newPrice, reason: reason });
}

// ── PnL calculation ──────────────────────────────────────────────────────

async function _calcPnl(trade, exchange, nowFn) {
  try {
    var pnlData = await exchange.getPositionPnl(trade.pair);
    if (pnlData && pnlData.realizedPnl != null && pnlData.realizedPnl !== '0') {
      var result = calcPnl(trade, pnlData);
      if (result.realizedPnl != null) {
        trade.realizedPnl = result.realizedPnl;
        trade.pnlPercent = result.pnlPercent;
        trade.fees = result.fees || 0;
        trade.pnlSource = result.fillMethod || 'bybit_api';
        console.log('[position-monitor] PnL for ' + trade.pair + ': $' + result.realizedPnl.toFixed(2) + ' (' + result.pnlPercent.toFixed(2) + '%)');
        return;
      }
    }
    // Fallback: TP fill price
    var tp0 = trade.tp && trade.tp[0];
    if (tp0 && tp0.filledPrice && trade.entry?.filled) {
      var dirMult = trade.direction === 'LONG' ? 1 : -1;
      var pnl = dirMult * (tp0.filledPrice - trade.entry.filled) * trade.qty;
      trade.realizedPnl = Math.round(pnl * 100) / 100;
      trade.pnlSource = 'tp_fill_fallback';
      console.log('[position-monitor] PnL (fallback) for ' + trade.pair + ': $' + trade.realizedPnl.toFixed(2));
    }
  } catch (err) {
    console.warn('[position-monitor] PnL calc error for ' + trade.pair + ': ' + err.message);
  }
}

// ── Reconcile ────────────────────────────────────────────────────────────

async function _reconcile(exchange, cfg, nowFn) {
  var trades = openTrades();

  for (var i = 0; i < trades.length; i++) {
    var trade = trades[i];
    if (trade.status === 'unfilled') continue;  // unfilled limit orders have no position yet
    try {
      var pos = await exchange.getPosition(trade.pair);
      if (pos.size === 0 || pos.side === null) {
        trade.status       = 'closed';
        trade.closedAt     = nowFn();
        trade.closedReason = 'reconciled_missing';

        await _calcPnl(trade, exchange, nowFn);
        closeTrade(trade);
        console.log('[position-monitor] reconcile: ' + trade.pair + ' ' + trade.id + ' marked closed (not on exchange)');
      }
    } catch (err) {
      console.warn('[position-monitor] reconcile ' + trade.pair + ': ' + err.message);
    }
  }

  if (cfg.reconcile?.adoptOrphans !== true) return;

  // Adopt exchange positions that have no local tracking file.
  // This handles the case where local state was cleared but exchange positions survived.
  var allPositions;
  try {
    allPositions = await exchange.getAllPositions();
  } catch (err) {
    console.warn('[position-monitor] adoptOrphans: getAllPositions failed: ' + err.message);
    return;
  }

  var localPairs = new Set(trades.map(function(t) { return t.pair; }));

  for (var j = 0; j < allPositions.length; j++) {
    var pos = allPositions[j];
    if (localPairs.has(pos.pair)) continue;  // already tracked locally

    var adoptId = 'adopt_' + pos.pair.toLowerCase() + '_' + Date.now().toString(36);
    var adoptedTrade = {
      id:          adoptId,
      pair:        pos.pair,
      direction:   pos.side,
      exchange:    'bybit',
      status:      'open',
      qty:         pos.size,
      entry:       { filled: pos.entryPrice, requested: pos.entryPrice, requestedAt: nowFn(), confirmedAt: nowFn(), slippageBps: 0 },
      sl:          { price: pos.stopLoss ?? 0, orderId: pos.stopLoss ? 'sl_trading-stop' : null, placementAttempts: 0 },
      tp:          [{ price: pos.takeProfit ?? 0, orderId: pos.takeProfit ? 'tp_trading-stop' : null, status: 'pending', filledAt: null, filledPrice: null, qty: pos.size }],
      slMoves:     [],
      riskCheck:   {},
      errors:      [],
      closedAt:    null,
      closedReason: null,
      realizedPnl: null,
      fees:        0,
      adoptedOrphan: true,
      adoptedAt:   nowFn(),
    };
    saveTrade(adoptedTrade);
    localPairs.add(pos.pair);
    console.log('[position-monitor] adoptOrphans: ' + pos.pair + ' ' + pos.side + ' @' + pos.entryPrice + ' imported from exchange');
  }
}

function _sleep(ms) { return new Promise(function(r) { setTimeout(r, ms); }); }
function _resetReconcileFlag() { _reconciled = false; }

module.exports = { tick, _resetReconcileFlag, _checkUnfilledTrade };
