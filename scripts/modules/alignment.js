'use strict';

function calculateAlignmentScore(htfAnalysis, ltfAnalysis) {
  const htfTrend = htfAnalysis.trend;
  const ltfTrend = ltfAnalysis.trend;

  // HTF score (0-50)
  let htfScore = htfTrend !== 'ranging' ? 40 : 10;
  if (htfTrend !== 'ranging' && htfAnalysis.bos.length > 0) htfScore += 10;

  // LTF score (0-30)
  let ltfScore = 0;
  if (htfTrend !== 'ranging') {
    if (ltfTrend === htfTrend)       ltfScore = 30;
    else if (ltfTrend === 'ranging') ltfScore = 15;
    else                             ltfScore = 0;
  } else {
    ltfScore = 15;
  }

  // POI confluence score (0-20)
  let confluenceCount = 0;
  if (ltfAnalysis.priceInHTF_OB)  confluenceCount++;
  if (ltfAnalysis.priceInHTF_FVG) confluenceCount++;
  if (ltfAnalysis.priceInHTF_BB)  confluenceCount++;
  const poiScore = Math.min(20, confluenceCount * 10);

  const score = htfScore + ltfScore + poiScore;

  // Tier determination
  let tier = 5;
  if (htfTrend !== 'ranging') {
    if (ltfTrend === htfTrend && ltfAnalysis.hasRecentBOS_in_htfDir) tier = 1;
    else if (ltfTrend === htfTrend)      tier = 2;
    else if (ltfTrend === 'ranging')     tier = 3;
    else                                 tier = 4;
  }

  return {
    score,
    tier,
    htfBias: htfTrend,
    ltfBias: ltfTrend,
    isAligned: tier <= 2,
    canTrade:  tier <= 3,
  };
}

module.exports = { calculateAlignmentScore };
