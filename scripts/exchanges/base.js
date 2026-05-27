'use strict';

/**
 * BaseExchange — abstract interface for exchange adapters.
 * All methods must be implemented by subclasses.
 *
 * @abstract
 */
class BaseExchange {
  /**
   * @param {{ apiKey: string, apiSecret: string, baseUrl: string }} creds
   */
  constructor(creds) {
    if (new.target === BaseExchange) {
      throw new Error('BaseExchange is abstract');
    }
    this.apiKey    = creds.apiKey;
    this.apiSecret = creds.apiSecret;
    this.baseUrl   = creds.baseUrl;
  }

  /** @returns {Promise<number>} server time in ms */
  async getServerTime() { _abstract(); }

  /**
   * @returns {Promise<number>} available USDT balance
   */
  async getAccountBalance() { _abstract(); }

  /**
   * Returns step/tick/minNotional for a symbol (cached).
   * @param {string} symbol
   * @returns {Promise<{ stepSize: number, tickSize: number, minNotional: number }>}
   */
  async getSymbolInfo(symbol) { _abstract(); }  // eslint-disable-line no-unused-vars

  /**
   * @param {string} symbol
   * @param {number} leverage  integer
   * @returns {Promise<void>}
   */
  async setLeverage(symbol, leverage) { _abstract(); }  // eslint-disable-line no-unused-vars

  /**
   * @param {string} symbol
   * @param {'isolated'|'cross'} marginType
   * @returns {Promise<void>}
   */
  async setMarginType(symbol, marginType) { _abstract(); }  // eslint-disable-line no-unused-vars

  /**
   * @param {string} symbol
   * @returns {Promise<number>} mark price
   */
  async getMarkPrice(symbol) { _abstract(); }  // eslint-disable-line no-unused-vars

  /**
   * Place a market order.
   * @param {string} symbol
   * @param {'BUY'|'SELL'} side
   * @param {number} qty
   * @returns {Promise<{ orderId: number|string, filledPrice: number, filledQty: number }>}
   */
  async placeMarketOrder(symbol, side, qty) { _abstract(); }  // eslint-disable-line no-unused-vars

  /**
   * Place a STOP_MARKET order (reduceOnly).
   * @param {string} symbol
   * @param {'BUY'|'SELL'} side
   * @param {number} stopPrice
   * @param {number} qty
   * @returns {Promise<{ orderId: number|string }>}
   */
  async placeStopMarket(symbol, side, stopPrice, qty) { _abstract(); }  // eslint-disable-line no-unused-vars

  /**
   * Place a TAKE_PROFIT_MARKET order (reduceOnly) for the full remaining position.
   * Uses position-level API (virtual orderId) — fill detected via position closure.
   * @param {string} symbol
   * @param {'BUY'|'SELL'} side
   * @param {number} stopPrice
   * @param {number} qty
   * @returns {Promise<{ orderId: number|string }>}
   */
  async placeTakeProfitMarket(symbol, side, stopPrice, qty) { _abstract(); }  // eslint-disable-line no-unused-vars

  /**
   * Place a conditional take-profit order for a specific qty (partial close).
   * Returns a real trackable orderId — fill detected when orderId leaves open orders.
   * @param {string} symbol
   * @param {'BUY'|'SELL'} side
   * @param {number} triggerPrice
   * @param {number} qty
   * @returns {Promise<{ orderId: number|string }>}
   */
  async placeTakeProfitOrder(symbol, side, triggerPrice, qty) { _abstract(); }  // eslint-disable-line no-unused-vars

  /**
   * @param {string} symbol
   * @returns {Promise<{ size: number, entryPrice: number, side: 'LONG'|'SHORT'|'BOTH'|null }>}
   */
  async getPosition(symbol) { _abstract(); }  // eslint-disable-line no-unused-vars

  /**
   * Returns all open positions across all symbols.
   * @returns {Promise<Array<{ pair: string, size: number, entryPrice: number, side: 'LONG'|'SHORT', stopLoss: number|null, takeProfit: number|null }>>}
   */
  async getAllPositions() { return []; }

  /**
   * @param {string} symbol
   * @returns {Promise<Array<{ orderId: number|string, type: string, side: string, stopPrice: number, origQty: number }>>}
   */
  async getOpenOrders(symbol) { _abstract(); }  // eslint-disable-line no-unused-vars

  /**
   * @param {string} symbol
   * @param {number|string} orderId
   * @returns {Promise<void>}
   */
  async cancelOrder(symbol, orderId) { _abstract(); }  // eslint-disable-line no-unused-vars

  /**
   * Emergency market close of the full position.
   * @param {string} symbol
   * @param {'LONG'|'SHORT'} positionSide
   * @returns {Promise<void>}
   */
  async closePosition(symbol, positionSide) { _abstract(); }  // eslint-disable-line no-unused-vars
}

function _abstract() {
  throw new Error('Not implemented');
}

module.exports = { BaseExchange };
