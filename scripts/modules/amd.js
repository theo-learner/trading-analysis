'use strict';

const MANIP_LOOKBACK = 10;
const DIST_LOOKBACK  = 20;

function detectAMDPhase(candles, swings, sweeps, bosEvents) {
  if (candles.length === 0 || swings.length === 0) return 'UNKNOWN';

  const lastIdx  = candles.length - 1;
  const recent20 = candles.slice(-20);
  const avgRange = recent20.reduce((sum, c) => sum + (c.high - c.low), 0) / recent20.length;

  const recentSwings = swings.slice(-10);
  const prices       = recentSwings.map(s => s.price);
  const swingRange   = Math.max(...prices) - Math.min(...prices);

  // Most recent confirmed sweep within DIST_LOOKBACK
  const mostRecentSweep = (sweeps || [])
    .filter(s => s.confirmed && (lastIdx - s.index) <= DIST_LOOKBACK)
    .sort((a, b) => b.index - a.index)[0] || null;

  // Most recent BOS
  const mostRecentBOS = (bosEvents && bosEvents.length > 0)
    ? [...bosEvents].sort((a, b) => b.index - a.index)[0]
    : null;

  // M→D: sweep exists + BOS occurred AFTER sweep + opposite direction
  if (mostRecentSweep && mostRecentBOS && mostRecentBOS.index > mostRecentSweep.index) {
    const oppositeDir =
      (mostRecentSweep.type === 'SSL' && mostRecentBOS.direction === 'bull') ||
      (mostRecentSweep.type === 'BSL' && mostRecentBOS.direction === 'bear');
    if (oppositeDir) return 'DISTRIBUTION';
  }

  // MANIPULATION: recent sweep with no subsequent valid BOS
  if (mostRecentSweep && (lastIdx - mostRecentSweep.index) <= MANIP_LOOKBACK) {
    return 'MANIPULATION';
  }

  // ACCUMULATION: tight range, no sweep, no BOS history
  if (swingRange < avgRange * 3 && !mostRecentSweep && !mostRecentBOS) return 'ACCUMULATION';

  return 'RESET';
}

module.exports = { detectAMDPhase };
