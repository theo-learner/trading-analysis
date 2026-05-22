'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadTradeEnv } = require('./load-env');

const SESSION_DIR = path.join(__dirname, '..', '..', 'sessions');

/**
 * Loads Binance API credentials from sessions/ directory.
 * Key:    sessions/binance-api-key.txt
 * Secret: sessions/binance-api-secret.txt
 *
 * @returns {{ apiKey: string, apiSecret: string }}
 * @throws {Error} if either file is missing or empty
 */
function loadBinanceCredentials() {
  const env = loadTradeEnv();
  if (env.BINANCE_API_KEY && env.BINANCE_API_SECRET) {
    return { apiKey: env.BINANCE_API_KEY, apiSecret: env.BINANCE_API_SECRET };
  }

  const keyPath = path.join(SESSION_DIR, 'binance-api-key.txt');
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Binance API key file not found: ${keyPath}`);
  }
  const apiKey = fs.readFileSync(keyPath, 'utf-8').trim();
  if (!apiKey) throw new Error('Binance API key file is empty');

  const secretPath = path.join(SESSION_DIR, 'binance-api-secret.txt');
  if (!fs.existsSync(secretPath)) {
    throw new Error(`Binance API secret file not found: ${secretPath}`);
  }
  const apiSecret = fs.readFileSync(secretPath, 'utf-8').trim();
  if (!apiSecret) throw new Error('Binance API secret file is empty');

  return { apiKey, apiSecret };
}

/**
 * Loads Bybit API credentials from a single file.
 * File: sessions/bybit-credentials.txt
 * Format: line 1 = API key, line 2 = API secret
 *
 * @returns {{ apiKey: string, apiSecret: string }}
 * @throws {Error} if file is missing or malformed
 */
function loadBybitCredentials() {
  const env = loadTradeEnv();
  if (env.BYBIT_API_KEY && env.BYBIT_API_SECRET) {
    return { apiKey: env.BYBIT_API_KEY, apiSecret: env.BYBIT_API_SECRET };
  }

  const filePath = path.join(SESSION_DIR, 'bybit-credentials.txt');
  if (!fs.existsSync(filePath)) {
    throw new Error(`Bybit credentials not found: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf-8').trim();
  // Support: two lines (key\nsecret) OR single line backslash-separated (key\secret)
  const parts = raw.includes('\n')
    ? raw.split('\n').map(l => l.trim()).filter(Boolean)
    : raw.split('\\').map(l => l.trim()).filter(Boolean);
  if (parts.length < 2) {
    throw new Error('bybit-credentials.txt: 두 줄(키/시크릿) 또는 백슬래시 구분(키\\시크릿) 형식 필요');
  }
  return { apiKey: parts[0], apiSecret: parts[1] };
}

module.exports = { loadBinanceCredentials, loadBybitCredentials };
