/**
 * logger.js — 구조화된 로깅 유틸리티
 *
 * 모든 스크립트에서 일관된 형식으로 로그를 출력한다.
 * 형식: [YYYY-MM-DD HH:mm:ss] [LEVEL] [module] message
 */

'use strict';

const LEVELS = { DEBUG: 0, INFO: 1, WARN: 2, ERROR: 3 };
const MIN_LEVEL = LEVELS[process.env.LOG_LEVEL?.toUpperCase()] ?? LEVELS.INFO;

function timestamp() {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

function log(level, module, message, data) {
  if (LEVELS[level] < MIN_LEVEL) return;
  const prefix = `[${timestamp()}] [${level.padEnd(5)}] [${module}]`;
  if (data !== undefined) {
    console.log(`${prefix} ${message}`, typeof data === 'object' ? JSON.stringify(data) : data);
  } else {
    console.log(`${prefix} ${message}`);
  }
}

/**
 * 특정 모듈용 logger 생성
 * @param {string} moduleName
 * @returns {{ debug, info, warn, error }}
 */
function createLogger(moduleName) {
  return {
    debug: (msg, data) => log('DEBUG', moduleName, msg, data),
    info:  (msg, data) => log('INFO',  moduleName, msg, data),
    warn:  (msg, data) => log('WARN',  moduleName, msg, data),
    error: (msg, data) => log('ERROR', moduleName, msg, data),
  };
}

module.exports = { createLogger };
