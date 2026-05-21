'use strict';

const fs   = require('node:fs');
const path = require('node:path');

const config = require('./config/ict-engine.json');

const { fetchCandleSet }          = require('./utils/binance');
const { isInKillzone, killzoneBonus } = require('./utils/time-utils');

const { detectSwingPoints }       = require('./modules/swing-points');
const { detectBOS, detectMSS, getCurrentTrend, filterByRecentSwings } = require('./modules/market-structure');
const { detectFVG }               = require('./modules/fvg');
const { detectOrderBlocks }       = require('./modules/order-block');
const { detectBreakerBlocks }     = require('./modules/breaker-block');
const { detectLiquiditySweeps }   = require('./modules/sweep');
const { isDisplacement }          = require('./modules/displacement');
const { bodySize, rollingAvgBody } = require('./utils/candle-utils');
const { calculateAlignmentScore } = require('./modules/alignment');
const { detectAMDPhase }          = require('./modules/amd');
const { calculateEntryScorecard } = require('./modules/scorecard');

// ── Private helpers ───────────────────────────────────────────────────────────

function validateInput(params) {
  if (!params.htfCandles || params.htfCandles.length < 100)
    throw new Error('HTF 캔들 최소 100개 필요');
  if (!params.ltfCandles || params.ltfCandles.length < 50)
    throw new Error('LTF 캔들 최소 50개 필요');
  if (!params.pair) throw new Error('pair 필요');
}

function normalize(candles) {
  return [...candles].sort((a, b) => a.time - b.time);
}

function selectBestPOI(ltfFVGs, ltfOBs, htfBBs, direction, currentPrice, ltfSwings) {
  const swingsBelow = ltfSwings.filter(s => s.type === 'low'  && s.price <= currentPrice);
  const swingsAbove = ltfSwings.filter(s => s.type === 'high' && s.price >= currentPrice);
  const rangeLow  = swingsBelow.length > 0 ? swingsBelow[swingsBelow.length - 1].price : -Infinity;
  const rangeHigh = swingsAbove.length > 0 ? swingsAbove[swingsAbove.length - 1].price : Infinity;

  const inRange = (poi) => poi.low < rangeHigh && poi.high > rangeLow;

  const activeFVGs = ltfFVGs.filter(f => f.status === 'active' && inRange(f)).map(p => ({ ...p, poiType: 'FVG' }));
  const activeOBs  = ltfOBs.filter(o => o.status === 'active' && inRange(o)).map(p => ({ ...p, poiType: 'OB' }));
  const pendingBBs = htfBBs.filter(b => b.retestStatus === 'pending' && inRange(b)).map(p => ({ ...p, poiType: 'BB' }));

  for (const list of [activeFVGs, activeOBs, pendingBBs]) {
    if (list.length === 0) continue;
    const best = direction === 'bull'
      ? list.reduce((b, p) => p.high > b.high ? p : b)
      : list.reduce((b, p) => p.low  < b.low  ? p : b);
    return { ...best, price: (best.high + best.low) / 2 };
  }
  return null;
}

function calculateSL(poi, htfSwings, direction) {
  const lastSwingLow  = htfSwings.filter(s => s.type === 'low').slice(-1)[0];
  const lastSwingHigh = htfSwings.filter(s => s.type === 'high').slice(-1)[0];
  if (direction === 'bull') {
    return Math.min(poi.low, lastSwingLow ? lastSwingLow.price : poi.low);
  }
  return Math.max(poi.high, lastSwingHigh ? lastSwingHigh.price : poi.high);
}

function calculateTP(entry, sl, minRR) {
  const risk = Math.abs(entry - sl);
  const sign = entry > sl ? 1 : -1;
  return [
    entry + sign * risk * minRR,
    entry + sign * risk * minRR * 1.5,
    entry + sign * risk * minRR * 2,
  ];
}

function scanDisplacements(candles, cfg) {
  const result = [];
  for (let i = 1; i < candles.length; i++) {
    if (isDisplacement(candles[i], candles, i, cfg.displacement)) {
      const c       = candles[i];
      const avgBody = rollingAvgBody(candles, cfg.displacement.rollingWindow, i);
      const body    = bodySize(c);
      result.push({
        index:         i,
        time:          c.time,
        direction:     c.close > c.open ? 'bull' : 'bear',
        bodyPct:       +(body / c.open * 100).toFixed(2),
        avgMultiplier: avgBody > 0 ? +(body / avgBody).toFixed(1) : null,
        close:         c.close,
      });
    }
  }
  return result;
}

function calculateConfidence(alignmentScore, kzBonus, sweepConfirmed, amdPhase) {
  let total = alignmentScore + kzBonus;
  if (amdPhase === 'MANIPULATION') total += 10;
  if (amdPhase === 'DISTRIBUTION') total += 5;
  if (sweepConfirmed) total += 10;
  if (total >= 80) return 'HIGH';
  if (total >= 60) return 'MEDIUM';
  return 'LOW';
}

function computeSwingRange(swings, lookback) {
  const recent = swings.slice(-lookback);
  const highs  = recent.filter(s => s.type === 'high');
  const lows   = recent.filter(s => s.type === 'low');
  if (highs.length === 0 || lows.length === 0) return null;
  const high    = Math.max(...highs.map(s => s.price));
  const low     = Math.min(...lows.map(s => s.price));
  const highSw  = highs.find(s => s.price === high);
  const lowSw   = lows.find(s => s.price === low);
  return { low, high, lowTime: lowSw.time, highTime: highSw.time, count: recent.length };
}

function buildNeutral(pair, reason, tier, currentPrice, extra = {}) {
  return {
    pair,
    timestamp: Math.floor(Date.now() / 1000),
    analysisDate: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10),
    direction: 'NEUTRAL',
    tier,
    alignmentScore: extra.alignmentScore || 0,
    confidence: 'LOW',
    reason,
    currentPrice,
    tradeBlocked: false,
    tradeBlockReason: '',
    ...extra,
  };
}

function buildSignal({ pair, direction, alignment, scorecard, poi, sl, tps, rr, confidence, htfTrend, ltfTrend, htfAMD, kzResult, fvgs, obs, bbs, sweeps, sizeMultiplier, currentPrice, mss, bos, displacements, swingRanges }) {
  const entry = poi.price;
  return {
    pair,
    timestamp: Math.floor(Date.now() / 1000),
    analysisDate: new Date(Date.now() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10),
    direction,
    tier: alignment.tier,
    alignmentScore: alignment.score,
    confidence,
    scorecard: {
      total:          scorecard.total,
      grade:          scorecard.grade,
      breakdown:      scorecard.breakdown,
      oteZone:        scorecard.oteZone,
      action:         scorecard.action,
      sizeMultiplier,
    },
    entry: {
      price:    entry,
      basis:    poi.poiType ? `${poi.poiType}_RETEST` : 'POI_RETEST',
      killzone: kzResult.inKillzone ? (kzResult.name || 'UNKNOWN') : null,
    },
    sl,
    slBasis: direction === 'LONG' ? 'BELOW_OB' : 'ABOVE_OB',
    tp:      tps,
    tpBasis: tps.map((_, i) => `TP${i + 1}`),
    rr,
    structure: {
      htfTrend,
      ltfTrend,
      amdPhase:   htfAMD,
      confluence: [],
    },
    levels: { fvgs, obs, bbs, sweeps },
    mss:          mss          || [],
    bos:          bos          || [],
    displacements: displacements || [],
    invalidation: {
      price:  sl,
      reason: direction === 'LONG' ? 'Close below SL' : 'Close above SL',
    },
    currentPrice,
    swingRanges: swingRanges || null,
    tradeBlocked: false,
    tradeBlockReason: '',
  };
}

// ── Main Pipeline ─────────────────────────────────────────────────────────────

/**
 * ICT 분석 엔진 — 27-step 파이프라인 (spec §17)
 * @param {Object}   params
 * @param {Candle[]} params.htfCandles  - 4H 캔들 (≥100개)
 * @param {Candle[]} params.ltfCandles  - 15m 캔들 (≥50개)
 * @param {Candle[]} [params.d1Candles] - 1D 캔들 (차트 컨텍스트)
 * @param {string}   params.pair
 * @param {Object}   [params.config]    - 설정 오버라이드
 * @returns {ICTSignal}
 */
function analyzeICT(params) {
  // [1] 입력 검증
  validateInput(params);

  // [2-3] 정렬 및 설정
  const cfg = { ...config, ...(params.config || {}) };
  const htfCandles = normalize(params.htfCandles);
  const ltfCandles = normalize(params.ltfCandles);

  // [4] HTF 스윙
  const htfSwings = detectSwingPoints(htfCandles, cfg.swingPoint.htf);

  // [5] HTF 구조
  const htfBOS    = detectBOS(htfCandles, htfSwings);
  const htfMSS    = detectMSS(htfCandles, htfSwings);
  const htfTrend  = getCurrentTrend(htfSwings);

  // [6-10] HTF POI + 스윕
  const dispFn    = (c, cs, idx) => isDisplacement(c, cs, idx, cfg.displacement);
  const htfFVGs   = detectFVG(htfCandles, cfg.fvg);
  const htfOBs    = detectOrderBlocks(htfCandles, htfSwings, dispFn);
  const htfBBs    = detectBreakerBlocks(htfCandles, htfOBs, cfg.breakerBlock);
  const htfSweeps = detectLiquiditySweeps(htfCandles, htfSwings, cfg.sweep);

  // [11] HTF AMD
  const htfAMD    = detectAMDPhase(htfCandles, htfSwings, htfSweeps, htfBOS);
  const htfBOS_events = [...htfBOS, ...htfMSS];
  const htfAnalysis = {
    trend: htfTrend, bos: htfBOS, mss: htfMSS,
    fvgs: htfFVGs, obs: htfOBs, bbs: htfBBs, sweeps: htfSweeps,
  };

  // [12] LTF 스윙
  const ltfSwings = detectSwingPoints(ltfCandles, cfg.swingPoint.ltf);

  // [13-17] LTF 구조 + POI + 스윕
  const ltfBOS    = detectBOS(ltfCandles, ltfSwings);
  const ltfMSS    = detectMSS(ltfCandles, ltfSwings);
  const ltfTrend  = getCurrentTrend(ltfSwings);
  const ltfFVGs   = detectFVG(ltfCandles, cfg.fvg);
  const ltfOBs    = detectOrderBlocks(ltfCandles, ltfSwings, dispFn);
  const ltfSweeps = detectLiquiditySweeps(ltfCandles, ltfSwings, cfg.sweep);

  // [18] 정렬 점수 (priceInHTF_* 플래그 사전 계산)
  const currentPrice = ltfCandles[ltfCandles.length - 1].close;
  const ltfAnalysis = {
    trend: ltfTrend, bos: ltfBOS, mss: ltfMSS,
    fvgs: ltfFVGs, obs: ltfOBs, sweeps: ltfSweeps,
    priceInHTF_OB:  htfOBs.some(o => o.status === 'active' && currentPrice >= o.low && currentPrice <= o.high),
    priceInHTF_FVG: htfFVGs.some(f => f.status === 'active' && currentPrice >= f.low && currentPrice <= f.high),
    priceInHTF_BB:  htfBBs.some(b => b.retestStatus === 'pending' && currentPrice >= b.low && currentPrice <= b.high),
    hasRecentBOS_in_htfDir: ltfBOS.some(b => b.direction === htfTrend),
  };

  const alignment = calculateAlignmentScore(htfAnalysis, ltfAnalysis);

  // MSS/BOS origin tags + displacements (shared across all paths)
  // Filter to recent 4 swings per origin to reduce chart marker density
  const SWING_LOOKBACK = cfg.signal?.recentSwingLookback ?? 4;
  const taggedMSS = [
    ...filterByRecentSwings(htfMSS, htfSwings, SWING_LOOKBACK).map(e => ({ ...e, origin: 'HTF' })),
    ...filterByRecentSwings(ltfMSS, ltfSwings, SWING_LOOKBACK).map(e => ({ ...e, origin: 'LTF' })),
  ];
  const taggedBOS = [
    ...filterByRecentSwings(htfBOS, htfSwings, SWING_LOOKBACK).map(e => ({ ...e, origin: 'HTF' })),
    ...filterByRecentSwings(ltfBOS, ltfSwings, SWING_LOOKBACK).map(e => ({ ...e, origin: 'LTF' })),
  ];
  const displacements = scanDisplacements(ltfCandles, cfg);

  // 스윙 범위 — 최근 N개 스윙의 min/max (다이어리 헤더용)
  const swingRanges = {
    htf: computeSwingRange(htfSwings, SWING_LOOKBACK),
    ltf: computeSwingRange(ltfSwings, SWING_LOOKBACK),
  };

  const neutralStructure = { htfTrend, ltfTrend, amdPhase: htfAMD };
  const neutralLevels    = {
    fvgs:   [...htfFVGs, ...ltfFVGs],
    obs:    [...htfOBs,  ...ltfOBs],
    bbs:    htfBBs,
    sweeps: [...htfSweeps, ...ltfSweeps],
  };

  // Tier ≥ 4 → NEUTRAL 조기 반환
  if (alignment.tier >= 4) {
    return buildNeutral(params.pair, `Tier ${alignment.tier}: 정렬 불충분`, alignment.tier, currentPrice,
      { alignmentScore: alignment.score, structure: neutralStructure, levels: neutralLevels, mss: taggedMSS, bos: taggedBOS, displacements, swingRanges });
  }

  // [19] 최적 POI 선택
  const poi = selectBestPOI(ltfFVGs, ltfOBs, htfBBs, alignment.htfBias, currentPrice, ltfSwings);
  if (!poi) {
    return buildNeutral(params.pair, 'POI 없음', alignment.tier, currentPrice,
      { alignmentScore: alignment.score, structure: neutralStructure, levels: neutralLevels, mss: taggedMSS, bos: taggedBOS, displacements, swingRanges });
  }

  // [20] 킬존
  const kzResult = isInKillzone(new Date());
  const kzBonus  = killzoneBonus(kzResult);

  // [21] 스코어카드
  const htfHighs = htfSwings.filter(s => s.type === 'high');
  const htfLows  = htfSwings.filter(s => s.type === 'low');
  const swingHigh = htfHighs.length > 0 ? htfHighs[htfHighs.length - 1].price : poi.high + 100;
  const swingLow  = htfLows.length  > 0 ? htfLows[htfLows.length - 1].price   : poi.low  - 100;
  const entryDirection = alignment.htfBias === 'bull' ? 'LONG' : 'SHORT';

  const scorecard = calculateEntryScorecard({
    htfTrend, entryDirection,
    killzoneResult: kzResult,
    entryPrice:   poi.price,
    swingHigh, swingLow,
    entryZone:    { high: poi.high, low: poi.low },
    activeFVGs:   [...htfFVGs, ...ltfFVGs].filter(f => f.status === 'active'),
    activeOBs:    [...htfOBs,  ...ltfOBs].filter(o => o.status === 'active'),
    activeBBs:    htfBBs.filter(b => b.retestStatus === 'pending'),
    sweeps:       [...htfSweeps, ...ltfSweeps],
    entryTimeSecs: Math.floor(Date.now() / 1000),
    tier:         alignment.tier,
    cfg,
  });

  // [22] 진입 결정
  if (scorecard.action !== 'ENTER') {
    return buildNeutral(params.pair, `Scorecard: ${scorecard.action}`, alignment.tier, currentPrice,
      { alignmentScore: alignment.score, structure: neutralStructure, levels: neutralLevels, scorecard, mss: taggedMSS, bos: taggedBOS, displacements, swingRanges });
  }

  // [23-25] SL / TP / R:R
  const sl  = calculateSL(poi, htfSwings, alignment.htfBias);
  const tps = calculateTP(poi.price, sl, cfg.signal.minRR);
  const rr  = Math.abs(tps[0] - poi.price) / Math.abs(poi.price - sl);

  // R:R 2:1 미만 → NEUTRAL (Appendix B §4)
  if (rr < cfg.signal.minRR) {
    return buildNeutral(params.pair, `R:R 미달 (${rr.toFixed(2)})`, alignment.tier, currentPrice,
      { alignmentScore: alignment.score, structure: neutralStructure, levels: neutralLevels, mss: taggedMSS, bos: taggedBOS, displacements, swingRanges });
  }

  // [26] 신뢰도
  const lastSweep = [...htfSweeps, ...ltfSweeps].filter(s => s.confirmed).slice(-1)[0];
  const confidence = calculateConfidence(alignment.score, kzBonus, !!lastSweep, htfAMD);

  // [27] 신호 반환
  return buildSignal({
    pair: params.pair,
    direction: entryDirection,
    alignment, scorecard, poi, sl, tps, rr, confidence,
    htfTrend, ltfTrend, htfAMD, kzResult,
    fvgs:   [...htfFVGs, ...ltfFVGs],
    obs:    [...htfOBs,  ...ltfOBs],
    bbs:    htfBBs,
    sweeps: [...htfSweeps, ...ltfSweeps],
    sizeMultiplier: scorecard.sizeMultiplier,
    currentPrice,
    mss: taggedMSS, bos: taggedBOS, displacements,
    swingRanges,
  });
}

module.exports = { analyzeICT, _selectBestPOI: selectBestPOI };

// ── CLI 진입점 ────────────────────────────────────────────────────────────────

if (require.main === module) {
  const args = process.argv.slice(2);
  const get  = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
  const pair = get('--pair') || 'BTCUSDT';

  const signalsDir = path.join(__dirname, '..', 'signals');
  if (!fs.existsSync(signalsDir)) fs.mkdirSync(signalsDir, { recursive: true });

  console.log(`[ict-engine] 분석 시작: ${pair}`);

  fetchCandleSet(pair)
    .then(({ htf, ltf, d1 }) => analyzeICT({ htfCandles: htf, ltfCandles: ltf, d1Candles: d1, pair }))
    .then(async (signal) => {
      const isoSafe = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${pair}_15m_${isoSafe}.json`;
      const outPath = path.join(signalsDir, filename);
      fs.writeFileSync(outPath, JSON.stringify(signal, null, 2));
      console.log(`[ict-engine] 신호 저장: ${outPath}`);
      console.log(`[ict-engine] direction=${signal.direction}, tier=${signal.tier}, confidence=${signal.confidence}`);

      try {
        const traderConfig = require('./config/trader.json');
        const { notifySignal } = require('./notify');
        const result = await notifySignal(signal, traderConfig);
        if (result.sent) {
          console.log('[ict-engine] telegram notification sent');
        } else {
          console.log(`[ict-engine] telegram skipped: ${result.skipped}`);
        }
      } catch (e) {
        console.error('[ict-engine] notify error (swallowed):', e.message);
      }
    })
    .catch((err) => {
      console.error('[ict-engine] 오류:', err.message);
      process.exit(1);
    });
}
