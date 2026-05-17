/**
 * candle-utils.js — OHLCV 캔들 데이터 공통 유틸리티
 *
 * ict-engine.js 및 기타 스크립트에서 공유하는 캔들 조작 함수들.
 */

'use strict';

/**
 * 캔들 바디 크기 (|close - open|)
 */
function bodySize(candle) {
  return Math.abs(candle.close - candle.open);
}

/**
 * 캔들 전체 범위 (high - low)
 */
function totalRange(candle) {
  return candle.high - candle.low;
}

/**
 * 상승봉 여부
 */
function isBullish(candle) {
  return candle.close > candle.open;
}

/**
 * 하강봉 여부
 */
function isBearish(candle) {
  return candle.close < candle.open;
}

/**
 * 롤링 평균 바디 크기
 * @param {Candle[]} candles
 * @param {number}   window - 기간
 * @param {number}   endIdx - 기준 인덱스 (exclusive)
 */
function rollingAvgBody(candles, window, endIdx) {
  const start = Math.max(0, endIdx - window);
  const slice = candles.slice(start, endIdx);
  if (slice.length === 0) return 0;
  return slice.reduce((sum, c) => sum + bodySize(c), 0) / slice.length;
}

/**
 * 가격 배열에서 최댓값
 */
function priceMax(candles, field = 'high') {
  return Math.max(...candles.map(c => c[field]));
}

/**
 * 가격 배열에서 최솟값
 */
function priceMin(candles, field = 'low') {
  return Math.min(...candles.map(c => c[field]));
}

module.exports = {
  bodySize,
  totalRange,
  isBullish,
  isBearish,
  rollingAvgBody,
  priceMax,
  priceMin,
};
