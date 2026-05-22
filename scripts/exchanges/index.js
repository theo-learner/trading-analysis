'use strict';

const { BinanceExchange } = require('./binance');
const { BybitExchange }   = require('./bybit');
const { loadBinanceCredentials, loadBybitCredentials } = require('../utils/exchange-creds');

/**
 * Factory — returns an exchange instance for the given name.
 *
 * @param {'binance'|'bybit'} name
 * @param {object} cfg - trader.json
 */
function getExchange(name, cfg) {
  if (name === 'binance') {
    const creds   = loadBinanceCredentials();
    const exchCfg = cfg?.exchange?.binance ?? {};
    return new BinanceExchange({
      apiKey:    creds.apiKey,
      apiSecret: creds.apiSecret,
      baseUrl:   exchCfg.useTestnet ? exchCfg.testnetUrl : (exchCfg.baseUrl ?? 'https://fapi.binance.com'),
    });
  }
  if (name === 'bybit') {
    const creds   = loadBybitCredentials();
    const exchCfg = cfg?.exchange?.bybit ?? {};
    return new BybitExchange({
      apiKey:    creds.apiKey,
      apiSecret: creds.apiSecret,
      baseUrl:   exchCfg.useTestnet ? exchCfg.testnetUrl : (exchCfg.baseUrl ?? 'https://api.bybit.com'),
    });
  }
  throw new Error(`Unknown exchange: ${name}`);
}

module.exports = { getExchange };
