'use strict';

const traderConfig = require('../config/trader.json');

function normalizePair(p) {
  if (typeof p === 'string') {
    return { symbol: p, exchange: 'binance', chartSource: 'binance', skipOnError: false };
  }
  const exchange = p.exchange || 'binance';
  return { exchange, chartSource: exchange, skipOnError: false, ...p };
}

function loadPairs() {
  return (traderConfig.pairs || []).map(normalizePair);
}

module.exports = { normalizePair, loadPairs };
