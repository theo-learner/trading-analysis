'use strict';

const { bodySize, totalRange, rollingAvgBody } = require('../utils/candle-utils');

/**
 * 캔들이 Displacement 패턴을 만족하는지 판단
 *
 * Displacement는 이전 평균 바디 크기 대비 크게 확대된 바디를 가지면서,
 * 반대 방향 심지가 작고, close가 범위의 극단에 가까운 캔들.
 *
 * @param {Candle}   candle - 판단할 캔들
 * @param {Candle[]} candles - 전체 캔들 시리즈 (avgBody 계산용)
 * @param {number}   endIdx - 기준 인덱스 (exclusive, candle의 위치)
 * @param {Object}   cfg - 설정
 *   - rollingWindow: number (평균 바디 계산 기간)
 *   - bodyMultiplier: number (바디 > avgBody * bodyMultiplier)
 *   - maxWickRatio: number (반대 심지 / 범위 <= 이 값)
 *   - closeAtExtremeRatio: number (close가 범위의 상단/하단 30% 이상에 있어야)
 * @returns {boolean} true if displacement pattern detected
 */
function isDisplacement(candle, candles, endIdx, cfg) {
  const { rollingWindow, bodyMultiplier, maxWickRatio, closeAtExtremeRatio } = cfg;

  // Step 1: compute avgBody from candles before endIdx
  const avgBody = rollingAvgBody(candles, rollingWindow, endIdx);
  if (avgBody === 0) return false;

  // Step 3: get body size
  const body = bodySize(candle);

  // Step 4: check if body is large enough
  if (body < avgBody * bodyMultiplier) return false;

  // Step 5: get total range
  const range = totalRange(candle);
  if (range === 0) return false;

  // Step 7: determine if bullish
  const isBull = candle.close > candle.open;

  // Step 8: calculate opposite wick
  const oppositeWick = isBull ? candle.open - candle.low : candle.high - candle.open;

  // Step 9: check if opposite wick is not too large
  if (oppositeWick / range > maxWickRatio) return false;

  // Step 10: calculate close position
  const closePos = isBull
    ? (candle.close - candle.low) / range
    : (candle.high - candle.close) / range;

  // Step 11: check if close is at extreme
  if (closePos < closeAtExtremeRatio) return false;

  // Step 12: all conditions met
  return true;
}

module.exports = { isDisplacement };
