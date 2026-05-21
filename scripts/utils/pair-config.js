'use strict';

const traderConfig = require('../config/trader.json');

function normalizePair(p) {
  if (typeof p === 'string') {
    return { symbol: p, exchange: 'binance', skipOnError: false };
  }
  return { exchange: 'binance', skipOnError: false, ...p };
}

function loadPairs() {
  return (traderConfig.pairs || []).map(normalizePair);
}

module.exports = { normalizePair, loadPairs };
