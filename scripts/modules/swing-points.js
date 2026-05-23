'use strict';

function detectSwingPoints(candles, { leftBars, rightBars }) {
  // 1. Standard local extrema detection
  const swings = [];
  for (let i = leftBars; i < candles.length - rightBars; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - leftBars; j <= i + rightBars; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low  <= candles[i].low)  isLow  = false;
    }
    if (isHigh) swings.push({ index: i, time: candles[i].time, price: candles[i].high, type: 'high' });
    if (isLow)  swings.push({ index: i, time: candles[i].time, price: candles[i].low,  type: 'low'  });
  }

  // 2. Post-process merge (flat zone clustering)
  const merged = mergeSwingClusters(swings);

  // 3. Rolling global extremes injection: scan the most recent candles
  //    (where flat zones tend to occur) and inject any global extremes
  //    not already covered by a detected swing.
  const recentWindow = Math.min(60, candles.length); // last 60 candles
  const recentCandles = candles.slice(-recentWindow);
  const recentStartIdx = candles.length - recentWindow;

  for (const type of ['high', 'low']) {
    // Top N extremes within the recent window only
    const candidates = recentCandles
      .map((c, i) => ({
        index: recentStartIdx + i,
        price: type === 'high' ? c.high : c.low,
        time: c.time,
      }))
      .sort((a, b) => type === 'high' ? b.price - a.price : a.price - b.price)
      .slice(0, 10);

    for (const cand of candidates) {
      const nearby = merged.some(s =>
        s.type === type &&
        Math.abs(s.index - cand.index) <= (rightBars + 5) &&
        Math.abs(cand.price - s.price) / cand.price < 0.003
      );
      if (!nearby) {
        // Check price isn't already very close to any swing of the same type
        const priceCovered = merged.some(s =>
          s.type === type && Math.abs(cand.price - s.price) / cand.price < 0.01
        );
        if (!priceCovered) {
          merged.push({ index: cand.index, time: cand.time, price: cand.price, type });
        }
      }
    }
  }

  // Final re-sort and re-merge (injected points might create new clusters)
  merged.sort((a, b) => a.index - b.index);
  return mergeSwingClusters(merged, 0.008);
}

// Post-process: merge swings from flat price zones into clusters.
// When multiple local lows/highs exist within tolerancePct, keep only
// the most extreme — so flat zones produce ONE swing at the absolute extreme.
function mergeSwingClusters(swings, tolerancePct = 0.005) {
  if (swings.length <= 1) return swings;
  swings.sort((a, b) => a.index - b.index);
  const clusters = [];
  for (const s of swings) {
    const group = clusters.find(g => g.type === s.type &&
      Math.abs(g.avgPrice - s.price) / g.avgPrice < tolerancePct);
    if (group) {
      group.candles.push(s);
      group.avgPrice = group.candles.reduce((a, b) => a + b.price, 0) / group.candles.length;
      group.lowest = Math.min(group.lowest, s.price);
      group.highest = Math.max(group.highest, s.price);
    } else {
      clusters.push({
        type: s.type,
        candles: [s],
        avgPrice: s.price,
        lowest: s.type === 'low' ? s.price : Infinity,
        highest: s.type === 'high' ? s.price : -Infinity,
      });
    }
  }
  return clusters.map(g => {
    const price = g.type === 'high' ? g.highest : g.lowest;
    const candle = g.candles.find(c => c.price === price);
    return {
      index: candle?.index ?? g.candles[g.candles.length - 1].index,
      time: candle?.time ?? g.candles[g.candles.length - 1].time,
      price,
      type: g.type,
    };
  });
}

module.exports = { detectSwingPoints };
