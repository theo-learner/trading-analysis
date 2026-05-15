'use strict';

function detectSwingPoints(candles, { leftBars, rightBars }) {
  const swings = [];
  for (let i = leftBars; i < candles.length - rightBars; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - leftBars; j <= i + rightBars; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low  <= candles[i].low)  isLow  = false;
    }
    // §4.2 fix: push AFTER j loop completes, not inside it
    if (isHigh) swings.push({ index: i, time: candles[i].time, price: candles[i].high, type: 'high' });
    if (isLow)  swings.push({ index: i, time: candles[i].time, price: candles[i].low,  type: 'low'  });
  }
  return swings;
}

module.exports = { detectSwingPoints };
