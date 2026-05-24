'use strict';

const crypto  = require('node:crypto');
const { getExchange } = require('./exchanges/index');
const { saveTrade, openCount, hasOpenTrade, openCountForPairAndDirection, getTrade } = require('./utils/trade-store');

/**
 * Executes a trade for an approved signal.
 *
 * In dry-run mode (cfg.mode !== 'live' OR env.TRADING_LIVE !== '1'):
 *   Records the trade to trades/live/open/ with fake orderIds — no actual exchange calls.
 *
 * In live mode:
 *   1. Preflight (balance, concurrent limit, slippage)
 *   2. setLeverage + setMarginType (idempotent)
 *   3. Market entry order
 *   4. SL placement (STOP_MARKET reduceOnly) — if fails, immediately close and abort
 *   5. TP1/2/3 placement (TAKE_PROFIT_MARKET 33/33/34%)
 *
 * @param {object} signal   - ICTSignal from ict-engine.js
 * @param {object} verdict  - from judgeSignal()
 * @param {object} cfg      - trader.json
 * @param {object} [deps]   - optional injection for testing
 * @returns {Promise<object>} trade record
 */
async function execute(signal, verdict, cfg, deps = {}) {
  const {
    exchangeFn = getExchange,
    nowFn      = () => new Date().toISOString(),
    env        = process.env,
  } = deps;

  const isLive = cfg.mode === 'live' && env.TRADING_LIVE === '1';
  const execCfg = cfg.execution ?? {};
  const marginUsd   = execCfg.marginUsd   ?? 10;
  const notionalUsd = execCfg.notionalUsd ?? 20;
  const leverage    = execCfg.leverage    ?? 2;
  const marginType  = cfg.position?.marginType ?? 'isolated';
  const exchangeName = execCfg.exchange ?? cfg.exchange?.default ?? 'binance';

  // Reject if marginUsd is below minimum
  const marginUsdMin = execCfg.marginUsdMin ?? 10;
  if (marginUsd < marginUsdMin) {
    throw new Error(`marginUsd ${marginUsd} < minimum ${marginUsdMin}`);
  }

  const tradeId = _tradeId(signal);
  const requestedAt = nowFn();

  // Early exits — apply before both dry-run and live paths
  if (openCountForPairAndDirection(signal.pair, signal.direction) >= (cfg.position?.maxPerPair ?? 2)) {
    return { pair: signal.pair, direction: signal.direction, dryRun: !isLive, preflightFailed: true, reason: `max_per_pair (${cfg.position?.maxPerPair ?? 2}/${cfg.position?.maxPerPair ?? 2}) for ${signal.pair} ${signal.direction}` };
  }
  // Block opposite direction entirely
  if (signal.direction === 'LONG') {
    const shortOpen = openCountForPairAndDirection(signal.pair, 'SHORT');
    if (shortOpen > 0) {
      return { pair: signal.pair, direction: signal.direction, dryRun: !isLive, preflightFailed: true, reason: `opposite direction SHORT is open (${signal.pair})` };
    }
  } else {
    const longOpen = openCountForPairAndDirection(signal.pair, 'LONG');
    if (longOpen > 0) {
      return { pair: signal.pair, direction: signal.direction, dryRun: !isLive, preflightFailed: true, reason: `opposite direction LONG is open (${signal.pair})` };
    }
  }
  if (getTrade(tradeId)) {
    return { pair: signal.pair, direction: signal.direction, dryRun: !isLive, preflightFailed: true, reason: 'already_attempted_this_minute' };
  }

  const trade = {
    id:          tradeId,
    signalKey:   verdict.reason,
    pair:        signal.pair,
    direction:   signal.direction,
    exchange:    exchangeName,
    leverage,
    marginType,
    marginUsd,
    notionalUsd,
    qty:         0,
    entry:       { requested: signal.entry.price, requestedAt },
    sl:          { price: signal.sl, orderId: null, placementAttempts: 0 },
    tp:          _buildTpSlots(signal.tp),
    slMoves:     [],
    riskCheck:   {},
    errors:      [],
    status:      'open',
    closedAt:    null,
    closedReason: null,
    realizedPnl: null,
    fees:        0,
    signal:      { pair: signal.pair, direction: signal.direction, tier: signal.tier, confidence: signal.confidence, entry: signal.entry, sl: signal.sl, tp: signal.tp, rr: signal.rr },
  };

  if (!isLive) {
    // Dry-run: 8자리 그대로 사용 (exchangeInfo stepSize 불필요)
    trade.qty = parseFloat((verdict.order.rawQty ?? (notionalUsd / signal.entry.price)).toFixed(8));
    _assignFakeOrders(trade);
    trade.entry.filled   = signal.entry.price;
    trade.entry.confirmedAt = requestedAt;
    trade.entry.slippageBps = 0;
    saveTrade(trade);
    return { ...trade, dryRun: true };
  }

  // ── Live execution ──────────────────────────────────────────────────────
  const exchange = exchangeFn(exchangeName, cfg);

  // 1. Preflight
  const preflight = await _preflight(signal, cfg, exchange, marginUsd, notionalUsd);
  trade.riskCheck = preflight.snapshot;
  if (!preflight.ok) {
    trade.status = 'failed';
    trade.closedReason = preflight.reason;
    saveTrade(trade);
    return { ...trade, preflightFailed: true, reason: preflight.reason };
  }

  // 2. Setup leverage & margin type (idempotent — warn only, never abort)
  let setupWarnings = [];
  try {
    await exchange.setMarginType(signal.pair, marginType);
  } catch (err) {
    trade.errors.push({ at: nowFn(), stage: 'setup_marginType', message: err.message });
    setupWarnings.push(err.message);
  }
  try {
    await exchange.setLeverage(signal.pair, leverage);
  } catch (err) {
    trade.errors.push({ at: nowFn(), stage: 'setup_leverage', message: err.message });
    setupWarnings.push(err.message);
  }
  if (setupWarnings.length > 0) {
    trade.errors.push({ at: nowFn(), stage: 'setup_warnings', message: setupWarnings.join('; ') });
  }

  // 3. Market entry
  const entrySide = signal.direction === 'LONG' ? 'BUY' : 'SELL';
  let filled;
  try {
    const info = await exchange.getSymbolInfo(signal.pair);
    trade.qty = _roundQty(verdict.order.rawQty ?? (notionalUsd / signal.entry.price), info.stepSize);
    filled = await exchange.placeMarketOrder(signal.pair, entrySide, trade.qty);
  } catch (err) {
    trade.status = 'failed';
    trade.closedReason = 'entry_failed';
    trade.errors.push({ at: nowFn(), stage: 'entry', message: err.message });
    saveTrade(trade);
    throw err;
  }

  trade.entry.orderId     = filled.orderId;
  trade.entry.filled      = filled.filledPrice;
  trade.entry.filledQty   = filled.filledQty;
  trade.entry.confirmedAt = nowFn();
  trade.entry.slippageBps = _slippageBps(signal.entry.price, filled.filledPrice);
  saveTrade(trade);

  // 4. SL placement (partial mode — returns null orderId on success for bybit)
  const closeSide = signal.direction === 'LONG' ? 'SELL' : 'BUY';
  trade.sl.price = signal.sl;
  let slPlaced = false;
  for (let attempt = 1; attempt <= (cfg.retry?.orderMaxAttempts ?? 3); attempt++) {
    trade.sl.placementAttempts = attempt;
    try {
      await exchange.placeStopMarket(signal.pair, closeSide, signal.sl, trade.qty);
      // bybit trading-stop API returns null orderId on success — verify position has SL
      await _sleep(500);
      const posCheck = await exchange.getPosition(signal.pair);
      if (posCheck.stopLoss) {
        slPlaced = true;
        trade.sl.orderId = 'sl_trading-stop';  // marker for null-id APIs
        break;
      }
    } catch (err) {
      trade.errors.push({ at: nowFn(), stage: `sl_attempt_${attempt}`, message: err.message });
      const delays = cfg.retry?.backoffMs ?? [250, 750, 2000];
      if (attempt <= delays.length) await _sleep(delays[attempt - 1]);
    }
  }

  if (!slPlaced) {
    // Emergency close — no SL means unprotected position
    trade.errors.push({ at: nowFn(), stage: 'sl_failed', message: 'SL placement exhausted — emergency close' });
    try {
      await exchange.closePosition(signal.pair, signal.direction);
    } catch (closeErr) {
      trade.errors.push({ at: nowFn(), stage: 'emergency_close', message: closeErr.message });
    }
    trade.status      = 'closed';
    trade.closedAt    = nowFn();
    trade.closedReason = 'sl_placement_failed';
    saveTrade(trade);
    return { ...trade, slFailed: true };
  }
  saveTrade(trade);

  // 5. TP orders (33/33/34 — Full mode)
  // Full mode: 1 TP via trading-stop API, TP2/TP3 via conditional market orders
  const info = await exchange.getSymbolInfo(signal.pair);
  const tpQtys = _splitQty(trade.qty, info.stepSize);
  for (let i = 0; i < trade.tp.length; i++) {
    const tpPrice = _roundPrice(signal.tp[i], info.tickSize);
    trade.tp[i].price = tpPrice;
    trade.tp[i].qty   = tpQtys[i];
    try {
      if (i === 0) {
        // TP1: trading-stop API (Full mode)
        await exchange.placeTakeProfitMarket(signal.pair, closeSide, tpPrice, tpQtys[i]);
        trade.tp[i].orderId = 'tp1_trading-stop';
      } else {
        // TP2/TP3: conditional market order
        const posSide = signal.direction;  // 'LONG' or 'SHORT'
        const r = await exchange.placeConditionalMarket(signal.pair, closeSide, tpPrice, tpQtys[i], posSide);
        trade.tp[i].orderId = 'tp' + (i + 1) + '_conditional';
      }
    } catch (err) {
      trade.errors.push({ at: nowFn(), stage: `tp${i + 1}`, message: err.message });
    }
  }

  saveTrade(trade);
  return trade;
}

// ── Helpers ───────────────────────────────────────────────────────────────

function _tradeId(signal) {
  const epoch = Math.floor(Date.now() / 60000) * 60000;
  return crypto.createHash('sha1').update(`${signal.pair}_${epoch}`).digest('hex').slice(0, 12);
}

function _buildTpSlots(tpArr) {
  return (tpArr ?? []).map((price, i) => ({
    level: i + 1, price, qty: 0, orderId: null, status: 'pending', filledAt: null, filledPrice: null,
  }));
}

function _roundQty(qty, stepSize) {
  if (!stepSize || stepSize <= 0) return parseFloat(qty.toFixed(8));
  const precision = Math.max(0, Math.round(-Math.log10(stepSize)));
  const factor = Math.pow(10, precision);
  // Ceiling ensures notional >= target — floor can produce qty * price < minNotional ($20)
  return parseFloat((Math.ceil(qty * factor) / factor).toFixed(precision));
}

function _roundPrice(price, tickSize) {
  if (!tickSize || tickSize <= 0) return price;
  const precision = Math.max(0, Math.round(-Math.log10(tickSize)));
  return parseFloat(price.toFixed(precision));
}

/**
 * Split total qty into 3 parts (33/33/34) respecting stepSize.
 * Third slice gets the remainder to avoid rounding loss.
 */
function _splitQty(totalQty, stepSize) {
  const precision = Math.max(0, Math.round(-Math.log10(stepSize ?? 0.001)));
  const part = parseFloat((totalQty * 0.33).toFixed(precision));
  const remainder = parseFloat((totalQty - part * 2).toFixed(precision));
  return [part, part, remainder];
}

function _slippageBps(requested, filled) {
  if (!requested || !filled) return 0;
  return parseFloat((Math.abs(filled - requested) / requested * 10000).toFixed(2));
}

async function _preflight(signal, cfg, exchange, marginUsd, notionalUsd) {
  const snap = {};
  try {
    // Balance check
    const balance = await exchange.getAccountBalance();
    snap.balanceUsd = parseFloat(balance.toFixed(2));
    if (balance < marginUsd) {
      return { ok: false, reason: `insufficient_balance (${balance.toFixed(2)} < ${marginUsd})`, snapshot: snap };
    }

    // minNotional check
    const info = await exchange.getSymbolInfo(signal.pair);
    snap.minNotional = info.minNotional;
    if (notionalUsd < info.minNotional) {
      return { ok: false, reason: `below_min_notional (${notionalUsd} < ${info.minNotional})`, snapshot: snap };
    }

    // marginUsd minimum
    const marginUsdMin = cfg.execution?.marginUsdMin ?? 10;
    if (marginUsd < marginUsdMin) {
      return { ok: false, reason: `marginUsd_below_min (${marginUsd} < ${marginUsdMin})`, snapshot: snap };
    }

    return { ok: true, snapshot: snap };
  } catch (err) {
    return { ok: false, reason: `preflight_error: ${err.message}`, snapshot: snap };
  }
}

function _assignFakeOrders(trade) {
  trade.sl.orderId = _fakeId();
  const tpQtys = _splitQty(trade.qty, 0.00000001);  // 8자리 precision for dry-run
  for (let i = 0; i < trade.tp.length; i++) {
    trade.tp[i].orderId = _fakeId();
    trade.tp[i].qty     = tpQtys[i];
  }
}

function _fakeId() {
  return `DRY_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

module.exports = { execute };
