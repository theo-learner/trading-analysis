'use strict';

function detectFVG(candles, { minGapPct }) {
  const fvgs = [];

  for (let i = 2; i < candles.length; i++) {
    const c1 = candles[i - 2];
    const c2 = candles[i - 1];
    const c3 = candles[i];

    // Bull FVG: gap between c1 top and c3 bottom
    if (c3.low > c1.high) {
      const gap = c3.low - c1.high;
      if (gap / c1.high >= minGapPct) {
        fvgs.push({
          index: i - 1,
          time: c2.time,
          high: c3.low,
          low: c1.high,
          direction: 'bull',
          status: 'active',
        });
      }
    }

    // Bear FVG: gap between c3 top and c1 bottom
    if (c1.low > c3.high) {
      const gap = c1.low - c3.high;
      if (gap / c1.low >= minGapPct) {
        fvgs.push({
          index: i - 1,
          time: c2.time,
          high: c1.low,
          low: c3.high,
          direction: 'bear',
          status: 'active',
        });
      }
    }
  }

  // Check mitigation: if a later candle closes inside the FVG
  for (const fvg of fvgs) {
    for (let i = fvg.index + 2; i < candles.length; i++) {
      const close = candles[i].close;
      if (close >= fvg.low && close <= fvg.high) {
        fvg.status = 'mitigated';
        break;
      }
    }
  }

  return fvgs;
}

module.exports = { detectFVG };
