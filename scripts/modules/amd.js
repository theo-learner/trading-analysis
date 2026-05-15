'use strict';

function detectAMDPhase(candles, swings, sweeps, bosEvents) {
  if (candles.length === 0 || swings.length === 0) return 'UNKNOWN';

  const recentSwings = swings.slice(-10);
  const prices = recentSwings.map(s => s.price);
  const swingRange = Math.max(...prices) - Math.min(...prices);

  const recent20 = candles.slice(-20);
  const avgRange = recent20.reduce((sum, c) => sum + (c.high - c.low), 0) / recent20.length;

  const manipLookback = 10;
  const lastIdx = candles.length - 1;

  const recentSweepInWindow = (sweeps || []).some(
    s => s.confirmed && (lastIdx - s.index) <= manipLookback,
  );

  const recentBOS = bosEvents && bosEvents.length > 0
    ? bosEvents[bosEvents.length - 1]
    : null;

  if (swingRange < avgRange * 3 && !recentSweepInWindow && !recentBOS) {
    return 'ACCUMULATION';
  }

  if (recentSweepInWindow) return 'MANIPULATION';

  if (recentBOS && (lastIdx - recentBOS.index) <= 5) return 'DISTRIBUTION';

  return 'RESET';
}

module.exports = { detectAMDPhase };
