'use strict';

function fmtPrice(p) {
  if (p === undefined || p === null) return '—';
  if (p >= 1000) return `$${p.toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`;
  return `$${p.toFixed(4).replace(/\.?0+$/, '')}`;
}

function fmtTime(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toISOString().replace('T', ' ').replace(/\.\d+Z$/, 'Z');
}

function trendLabel(trend) {
  if (trend === 'bull') return '상승 추세 (bull)';
  if (trend === 'bear') return '하락 추세 (bear)';
  if (trend === 'ranging') return '횡보 (ranging)';
  return trend || '알 수 없음';
}

function amdLabel(phase) {
  const map = {
    ACCUMULATION: 'ACCUMULATION (축적)',
    MANIPULATION: 'MANIPULATION (조작)',
    DISTRIBUTION: 'DISTRIBUTION (분배)',
    RESET:        'RESET (리셋)',
  };
  return (phase && map[phase]) || phase || '—';
}

function renderSwingRangeLine(label, range) {
  if (!range) return `**스윙 범위 (${label})**: 데이터 부족`;
  return `**스윙 범위 (${label})**: ${fmtPrice(range.low)} ~ ${fmtPrice(range.high)} (최근 ${range.count}개 스윙)`;
}

function gradeFVG(fvg, mssEvents, oteZone) {
  const inOTE     = oteZone === 'OTE';
  const recentMSS = mssEvents && mssEvents.length > 0 ? mssEvents[mssEvents.length - 1] : null;
  const afterMSS  = recentMSS && fvg.time != null && fvg.time >= recentMSS.time;
  if (inOTE && (afterMSS || (mssEvents && mssEvents.length > 0))) return 'A+';
  if (inOTE || afterMSS) return 'A';
  return 'B';
}

function detectUnicorn(bbs, fvgs, swingRange) {
  const inRange = z => !swingRange || (z.high >= swingRange.low && z.low <= swingRange.high);
  const activeFVGs = (fvgs || []).filter(f => f.status === 'active' && inRange(f));
  const pendingBBs = (bbs  || []).filter(b => b.retestStatus === 'pending' && inRange(b));
  for (const bb of pendingBBs) {
    for (const fvg of activeFVGs) {
      if (bb.low < fvg.high && bb.high > fvg.low) {
        const overlapLow  = Math.max(bb.low,  fvg.low);
        const overlapHigh = Math.min(bb.high, fvg.high);
        return { detected: true, bb, fvg, overlapLow, overlapHigh, ce: (overlapLow + overlapHigh) / 2 };
      }
    }
  }
  return { detected: false };
}

function deriveERLIRL(signal) {
  const sweeps = (signal.levels && signal.levels.sweeps) || [];
  const fvgs   = (signal.levels && signal.levels.fvgs)   || [];
  const obs    = (signal.levels && signal.levels.obs)    || [];

  const confirmedSSL = sweeps.filter(s => s.type === 'SSL' && s.confirmed);
  const pendingBSL   = sweeps.filter(s => s.type === 'BSL' && !s.confirmed);
  const confirmedBSL = sweeps.filter(s => s.type === 'BSL' && s.confirmed);
  const pendingSSL   = sweeps.filter(s => s.type === 'SSL' && !s.confirmed);

  const erlLow  = confirmedSSL.length > 0 ? confirmedSSL.slice(-1)[0] : (pendingSSL.length > 0 ? pendingSSL.slice(-1)[0] : null);
  const erlHigh = pendingBSL.length  > 0 ? pendingBSL.slice(-1)[0]  : (confirmedBSL.length > 0 ? confirmedBSL.slice(-1)[0] : null);

  const cp      = signal.currentPrice;
  const activeFVGs = fvgs.filter(f => f.status === 'active');
  const activeOBs  = obs.filter(o => o.status === 'active');
  const irlZone = activeFVGs.find(f => cp >= f.low && cp <= f.high) || activeOBs.find(o => cp >= o.low && cp <= o.high) || null;

  return { erlLow, erlHigh, irlZone, activeFVGs, activeOBs };
}

function getSwingRange(signal) {
  const sweeps = (signal.levels && signal.levels.sweeps) || [];
  const cp     = signal.currentPrice || 0;

  if (signal.direction === 'LONG') {
    const confirmedSSL = sweeps.filter(s => s.type === 'SSL' && s.confirmed).slice(-1)[0];
    const pendingBSL   = sweeps.filter(s => s.type === 'BSL' && !s.confirmed)[0];
    return {
      low:  confirmedSSL ? confirmedSSL.price : cp * 0.97,
      high: pendingBSL   ? pendingBSL.price   : cp * 1.05,
    };
  }
  if (signal.direction === 'SHORT') {
    const confirmedBSL = sweeps.filter(s => s.type === 'BSL' && s.confirmed).slice(-1)[0];
    const pendingSSL   = sweeps.filter(s => s.type === 'SSL' && !s.confirmed)[0];
    return {
      low:  pendingSSL   ? pendingSSL.price   : cp * 0.95,
      high: confirmedBSL ? confirmedBSL.price : cp * 1.03,
    };
  }
  return { low: cp * 0.97, high: cp * 1.03 };
}

// ── 6단계 렌더러 ──────────────────────────────────────────────────────────────

function renderStep1(signal) {
  const ts = signal.timestamp ? new Date(signal.timestamp * 1000).toISOString() : (signal.analysisDate || '—');
  return [
    `## 1단계 · 차트 선정`,
    `- **페어**: ${signal.pair}`,
    `- **분석 TF**: HTF 4H / LTF 15M`,
    `- **분석 시각**: ${ts}`,
    `- **현재가**: ${fmtPrice(signal.currentPrice)}`,
    '',
  ].join('\n');
}

function renderStep2(signal) {
  const s   = signal.structure || {};
  const htf = s.htfTrend;
  const ltf = s.ltfTrend;
  const amd = s.amdPhase;
  const aligned = htf === ltf ? 'HTF와 정렬' : 'HTF와 충돌';
  const conflict = htf !== ltf
    ? `\n- **충돌**: HTF ${trendLabel(htf)} + LTF ${trendLabel(ltf)} → 진입 트리거 부재`
    : '';
  return [
    `## 2단계 · 구조 분석`,
    `- **HTF (4H)**: ${trendLabel(htf)}`,
    `- **LTF (15M)**: ${trendLabel(ltf)} — ${aligned}`,
    `- **AMD 단계**: ${amdLabel(amd)}${conflict}`,
    '',
  ].join('\n');
}

function renderStep3(signal) {
  const sweeps = (signal.levels && signal.levels.sweeps) || [];
  if (sweeps.length === 0) {
    return [
      `## 3단계 · 유동성 식별`,
      `**최근 스윕**: 없음 (감지된 스윕 이벤트 없음)`,
      '',
    ].join('\n');
  }

  const swingRange    = getSwingRange(signal);
  const confirmed     = sweeps.filter(s => s.confirmed && s.price >= swingRange.low && s.price <= swingRange.high);

  if (confirmed.length === 0) {
    return [
      `## 3단계 · 유동성 식별`,
      `**확정 스윕**: 없음 (스윙 범위 ${fmtPrice(swingRange.low)}~${fmtPrice(swingRange.high)} 내)`,
      '',
    ].join('\n');
  }

  const dir = signal.direction;
  const isRelevant = s =>
    (dir === 'LONG'  && s.type === 'SSL') ||
    (dir === 'SHORT' && s.type === 'BSL');

  const sorted  = confirmed.slice().sort((a, b) =>
    (isRelevant(b) ? 1 : 0) - (isRelevant(a) ? 1 : 0) ||
    ((b.time || 0) - (a.time || 0))
  );
  const top     = sorted.slice(0, 3);
  const omitted = confirmed.length - top.length;
  const suffix  = omitted > 0 ? ` *(외 ${omitted}개 생략)*` : '';

  const lines = top.map(s =>
    `- ${s.type} @ ${fmtPrice(s.price)}, close ${fmtPrice(s.close)} (${s.origin || 'LTF'}, ${fmtTime(s.time)})`
  );

  const confirmedSSL = confirmed.filter(s => s.type === 'SSL');
  const confirmedBSL = confirmed.filter(s => s.type === 'BSL');
  let narrative = '';
  if (confirmedSSL.length > 0 && dir === 'LONG') {
    narrative = '\n방향: SSL 스윕 후 반등 → 매수측 유동성 회수 시나리오';
  } else if (confirmedBSL.length > 0 && dir === 'SHORT') {
    narrative = '\n방향: BSL 스윕 후 하락 → 매도측 유동성 회수 시나리오';
  }

  return [
    `## 3단계 · 유동성 식별`,
    `**확정 스윕** (스윙 범위 내, 최대 3개)${suffix}:`,
    ...lines,
    narrative,
    '',
  ].join('\n');
}

function renderStep4(signal, gradedFVGs) {
  const disps      = signal.displacements || [];
  const swingRange = getSwingRange(signal);

  // most recent 3 displacements, newest first
  const alignedDir  = signal.direction === 'LONG' ? 'bull' : signal.direction === 'SHORT' ? 'bear' : null;
  const recentDisps = disps.slice(-3).reverse();
  let fmtDisp;
  if (recentDisps.length === 0) {
    fmtDisp = '**Displacement**: 감지되지 않음';
  } else {
    const header = `**Displacement 캔들** (LTF · 총 ${disps.length}개 감지 · 최근 ${recentDisps.length}개)`;
    const rows = recentDisps.map(d => {
      const arrow    = d.direction === 'bull' ? '▲' : '▼';
      const sign     = d.direction === 'bull' ? '+' : '-';
      const kst      = new Date((d.time + 9 * 3600) * 1000).toISOString().slice(0, 16).replace('T', ' ');
      const alignTag = alignedDir && d.direction === alignedDir ? ' ← **방향 일치**' : '';
      return `  - ${arrow} ${kst} KST · close ${fmtPrice(d.close)} · body ${sign}${d.bodyPct}%${alignTag}`;
    });
    fmtDisp = header + '\n' + rows.join('\n');
  }

  // active FVGs within current swing range only (max 3)
  const gradeOrder = { 'A+': 0, 'A': 1, 'B': 2 };
  const inRangeFVGs = gradedFVGs
    .filter(f => f.status === 'active' && f.high >= swingRange.low && f.low <= swingRange.high)
    .sort((a, b) => (gradeOrder[a.grade] ?? 2) - (gradeOrder[b.grade] ?? 2))
    .slice(0, 3);

  const totalActive = gradedFVGs.filter(f => f.status === 'active').length;
  const omitted     = totalActive - inRangeFVGs.length;

  const fvgHeader = signal.structure && signal.structure.ltfTrend === 'bear' ? 'bear' : 'bull';
  let fvgText = '';
  if (inRangeFVGs.length > 0) {
    const suffix = omitted > 0 ? ` *(외 ${omitted}개 범위 외 생략)*` : '';
    fvgText = `\n**Active FVG** (LTF, ${fvgHeader})${suffix}:\n` +
      inRangeFVGs.map((f, i) => {
        const ce       = f.ce !== undefined ? f.ce : (f.low + f.high) / 2;
        const gradeTag = f.grade === 'A+' ? ` · **${f.grade}** (MSS 직후 + OTE 구간)` : ` · ${f.grade || 'B'}`;
        return `  - FVG #${i + 1}: ${fmtPrice(f.low)} ~ ${fmtPrice(f.high)} · CE ${fmtPrice(ce)} · status: ${f.status}${gradeTag}`;
      }).join('\n');
  } else {
    fvgText = '\n**Active FVG**: 없음 (스윙 범위 내)';
  }
  return [
    `## 4단계 · 핵심 증거 (Displacement + FVG)`,
    fmtDisp + fvgText,
    '',
  ].join('\n');
}

function renderStep5(signal) {
  const mssArr    = signal.mss || [];
  const bosArr    = signal.bos || [];
  const swingRange = getSwingRange(signal);
  const dir       = signal.direction;

  const isRelevant = e =>
    (dir === 'LONG'  && e.direction === 'bull') ||
    (dir === 'SHORT' && e.direction === 'bear');

  function pickTop(arr) {
    const inRange = arr.filter(e => e.price >= swingRange.low && e.price <= swingRange.high);
    const sorted  = inRange.slice().sort((a, b) =>
      (isRelevant(b) ? 1 : 0) - (isRelevant(a) ? 1 : 0) ||
      ((b.time || 0) - (a.time || 0))
    );
    const top     = sorted.slice(0, 3);
    const omitted = arr.length - top.length;
    const suffix  = omitted > 0 ? ` *(외 ${omitted}개 범위 외 생략)*` : '';
    return { top, suffix, inRangeCount: inRange.length };
  }

  const rangeSuffix = `스윙 범위 ${fmtPrice(swingRange.low)}~${fmtPrice(swingRange.high)} 밖`;

  let mssLines;
  if (mssArr.length === 0) {
    mssLines = ['- **MSS**: 최근 100봉 내 없음'];
  } else {
    const { top, suffix, inRangeCount } = pickTop(mssArr);
    if (inRangeCount === 0) {
      const omittedSuffix = mssArr.length > 0 ? ` *(외 ${mssArr.length}개 범위 외 생략)*` : '';
      mssLines = [`- **MSS**: 최근 100봉 내 없음 (${rangeSuffix}${omittedSuffix})`];
    } else {
      mssLines = [
        `- **MSS** (스윙 범위 내, 최대 3개)${suffix}:`,
        ...top.map(m =>
          `  - (${m.origin || 'LTF'}) ${fmtTime(m.time)} · ${fmtPrice(m.price)}에서 직전 ${m.direction === 'bull' ? 'LH' : 'HL'} 돌파 → ${m.direction} MSS 확정`
        ),
      ];
    }
  }

  let bosLines;
  if (bosArr.length === 0) {
    bosLines = ['- **BOS**: 감지 없음'];
  } else {
    const { top, suffix, inRangeCount } = pickTop(bosArr);
    if (inRangeCount === 0) {
      const omittedSuffix = bosArr.length > 0 ? ` *(외 ${bosArr.length}개 범위 외 생략)*` : '';
      bosLines = [`- **BOS**: 감지 없음 (${rangeSuffix}${omittedSuffix})`];
    } else {
      bosLines = [
        `- **BOS** (스윙 범위 내, 최대 3개)${suffix}:`,
        ...top.map(b =>
          `  - (${b.origin || 'HTF'}) ${fmtTime(b.time)} · ${fmtPrice(b.price)} → ${b.direction === 'bull' ? '상승' : '하락'} 추세 연속성 확인`
        ),
      ];
    }
  }

  return [
    `## 5단계 · 구조 변화 확인`,
    ...mssLines,
    ...bosLines,
    '',
  ].join('\n');
}

function renderStep6(signal) {
  const htf    = (signal.structure && signal.structure.htfTrend) || 'unknown';
  const ltf    = (signal.structure && signal.structure.ltfTrend) || 'unknown';
  const amd    = (signal.structure && signal.structure.amdPhase) || '';
  const sweeps = (signal.levels && signal.levels.sweeps) || [];
  const disps  = signal.displacements || [];
  const mssArr = signal.mss || [];

  if (signal.direction === 'NEUTRAL') {
    return [
      `## 6단계 · 스토리텔링`,
      `HTF는 ${trendLabel(htf)}이고 LTF는 ${trendLabel(ltf)}이다. ` +
      (mssArr.length === 0 && disps.length === 0
        ? `의미 있는 스윕도, 디스플레이스먼트도, MSS도 부재한 "관망 구간". 다이어리 학습 대상으로는 부적합 — A+ 셋업이 형성되기까지 대기.`
        : `진입 조건 미충족 — 추가 구조 형성 대기.`),
      '',
    ].join('\n');
  }

  const confirmedSweep  = sweeps.filter(s => s.confirmed).slice(-1)[0];
  const pendingLiquidity = sweeps.filter(s => !s.confirmed).slice(-1)[0];
  const sweepText = confirmedSweep
    ? `LTF가 ${confirmedSweep.type}(${fmtPrice(confirmedSweep.price)})을 의도적으로 스윕한 직후, `
    : '';
  const dispText  = disps.length > 0 ? `${disps[0].bodyPct}% 디스플레이스먼트와 함께 ` : '';
  const mssText   = mssArr.length > 0
    ? `직전 ${mssArr[0].direction === 'bull' ? 'LH' : 'HL'}를 돌파하며 MSS를 만들었다.`
    : '구조 변화가 감지됐다.';
  const amdText   = amd === 'DISTRIBUTION' ? ' 기관은 분배 단계로 보이며,' : amd === 'MANIPULATION' ? ' 조작 단계에서 유동성 회수 후' : '';
  const targetText = pendingLiquidity
    ? ` 잔존 ${pendingLiquidity.type === 'BSL' ? '매수' : '매도'}측 유동성(${fmtPrice(pendingLiquidity.price)})이 다음 목표.`
    : '';

  return [
    `## 6단계 · 스토리텔링`,
    `HTF ${trendLabel(htf)} 상태에서 ${sweepText}${dispText}${mssText}${amdText}${targetText}`,
    '',
  ].join('\n');
}

// ── 심화 단계 렌더러 ──────────────────────────────────────────────────────────

function renderAdvanced1(signal, erlIrl) {
  const { erlLow, erlHigh, irlZone } = erlIrl;
  const erlLowText  = erlLow  ? `${fmtPrice(erlLow.price)} (${erlLow.type}, ${erlLow.confirmed ? '확정' : '미확정'})` : '—';
  const erlHighText = erlHigh ? `${fmtPrice(erlHigh.price)} (${erlHigh.type}, ${erlHigh.confirmed ? '확정' : '미확정'})` : '—';
  const posText = irlZone
    ? `IRL (FVG/OB ${fmtPrice(irlZone.low)}-${fmtPrice(irlZone.high)} 내부)`
    : 'ERL 방향으로 이동 중';
  const dirText = erlHigh && signal.direction === 'LONG'
    ? `ERL 상단(${erlHigh.type})을 향해 이동 중 — 연료 보충 후 재진행`
    : erlLow && signal.direction === 'SHORT'
      ? `ERL 하단(${erlLow.type})을 향해 이동 중`
      : '방향 결정 중';
  return [
    `## 심화 1 · 딜링 레인지 (ERL/IRL)`,
    `- **ERL 상단**: ${erlHighText}`,
    `- **ERL 하단**: ${erlLowText}`,
    `- **현재 위치**: ${posText}`,
    `- **방향성**: ${dirText}`,
    '',
  ].join('\n');
}

function renderAdvanced2(gradedFVGs, mssArr, swingRange) {
  const fvgsToShow = gradedFVGs
    .filter(f => (f.status === 'active' || f.status === 'tested') &&
                 f.high >= swingRange.low && f.low <= swingRange.high);
  if (fvgsToShow.length === 0) {
    return `## 심화 2 · FVG 등급 + 결과 추적\n감지된 FVG 없음 (스윙 범위 내)\n\n`;
  }
  const rows = fvgsToShow.map((f, i) => {
    const ce      = f.ce !== undefined ? f.ce : (f.low + f.high) / 2;
    const mssTag  = mssArr && mssArr.length > 0 ? '✅' : '❌';
    const oteTag  = f.grade === 'A+' || f.grade === 'A' ? 'OTE (62-79%)' : 'DEEP';
    return `| #${i + 1} (${fmtPrice(f.low)}-${fmtPrice(f.high)}) | ${fmtPrice(ce)} | ${mssTag} | ${oteTag} | **${f.grade || 'B'}** | ${f.status} |`;
  });
  return [
    `## 심화 2 · FVG 등급 + 결과 추적`,
    `| FVG | CE | MSS 유발 | OTE 위치 | 등급 | Outcome |`,
    `|-----|----|---------|---------|------|---------|`,
    ...rows,
    '',
  ].join('\n');
}

function renderAdvanced3(signal, unicorn) {
  const swingRange = getSwingRange(signal);
  const allBBs = (signal.levels && signal.levels.bbs) || [];
  const bbs = allBBs.filter(b => b.high >= swingRange.low && b.low <= swingRange.high);
  const bbText = bbs.length > 0
    ? bbs.map(b => `- **Breaker Block 발견**: BB ${fmtPrice(b.low)}-${fmtPrice(b.high)} (이전 OB가 MSS로 반전)`).join('\n')
    : `- **Breaker Block**: 없음 (스윙 범위 ${fmtPrice(swingRange.low)}~${fmtPrice(swingRange.high)} 내)`;
  const unicornText = unicorn.detected
    ? [
        `- **FVG 중첩**: BB(${fmtPrice(unicorn.bb.low)}-${fmtPrice(unicorn.bb.high)}) ∩ FVG(${fmtPrice(unicorn.fvg.low)}-${fmtPrice(unicorn.fvg.high)}) = **유니콘 셋업 감지** ✅`,
        signal.entry
          ? `- **결론**: 진입가 ${fmtPrice(unicorn.ce)} (BB+FVG CE 평균), SL ${fmtPrice(signal.sl)}, TP1 ${fmtPrice(signal.tp && signal.tp[0])}, R:R ${signal.rr ? signal.rr.toFixed(1) : '—'}`
          : '',
      ].filter(Boolean).join('\n')
    : '- **Unicorn 셋업**: 미감지 (BB ∩ FVG 중첩 없음)';
  return [
    `## 심화 3 · Breaker Block + Unicorn 셋업`,
    bbText,
    unicornText,
    '',
  ].join('\n');
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * ICT signal → 구조 다이어리 마크다운 (6단계 + 심화 3단계)
 * @param {Object}  signal       — analyzeICT() 반환값 (mss/bos/displacements 포함)
 * @param {Object}  [opts]
 * @param {boolean} [opts.returnStruct] — true이면 구조 객체 반환 (테스트용)
 * @returns {string|Object}
 */
function buildDiary(signal, opts = {}) {
  const { returnStruct = false } = opts;

  const isNeutral = signal.direction === 'NEUTRAL';
  const grade     = signal.scorecard && signal.scorecard.grade;
  const mssArr    = signal.mss || [];
  const oteZone   = signal.scorecard && signal.scorecard.oteZone;
  const rawFVGs   = (signal.levels && signal.levels.fvgs) || [];
  const bbs       = (signal.levels && signal.levels.bbs)  || [];

  const gradedFVGs = rawFVGs.map(f => ({ ...f, grade: gradeFVG(f, mssArr, oteZone) }));
  const unicorn    = detectUnicorn(bbs, rawFVGs, getSwingRange(signal));
  const erlIrl     = deriveERLIRL(signal);

  if (returnStruct) {
    return { fvgs: gradedFVGs, unicorn, erlIrl };
  }

  const kst = signal.timestamp
    ? new Date(signal.timestamp * 1000 + 9 * 3600 * 1000).toISOString().slice(0, 16).replace('T', ' ')
    : (signal.analysisDate || '—');

  const gradeLabel = isNeutral
    ? 'SKIP — 조건 미충족'
    : (grade ? `${grade} (스코어카드 ${signal.scorecard.total}/5.0)` : '—');
  const actionLine = isNeutral ? '' : `\n**액션**: ENTER · ${signal.direction} · 사이즈 ${signal.scorecard && signal.scorecard.sizeMultiplier !== undefined ? signal.scorecard.sizeMultiplier + 'x' : '—'}`;
  const reasonLine = isNeutral && signal.reason ? `\n**사유**: ${signal.reason}` : '';

  const swingRangeLines = signal.swingRanges != null
    ? [
        renderSwingRangeLine('HTF 4H',  signal.swingRanges.htf),
        renderSwingRangeLine('LTF 15M', signal.swingRanges.ltf),
      ]
    : [];

  const header = [
    `# 구조 다이어리 — ${signal.pair} (HTF: 4H, LTF: 15M)`,
    ``,
    `**분석 시각**: ${kst} KST`,
    `**진입 등급**: ${gradeLabel}${reasonLine}${actionLine}`,
    ...swingRangeLines,
    ``,
  ].join('\n');

  const steps = [
    renderStep1(signal),
    renderStep2(signal),
    renderStep3(signal),
    renderStep4(signal, gradedFVGs),
    renderStep5(signal),
    renderStep6(signal),
  ].join('\n');

  const signalRef = `**관련 시그널**: 분석 시각 ${signal.analysisDate || '—'}`;

  if (isNeutral) {
    return header + steps + [
      `---`,
      ``,
      `**심화 단계 생략**: NEUTRAL signal은 ERL/IRL · FVG 등급 · Unicorn 분석을 수행하지 않는다 (분석 신뢰도 부족).`,
      ``,
      signalRef,
    ].join('\n');
  }

  return header + steps + [
    `---`,
    ``,
    renderAdvanced1(signal, erlIrl),
    renderAdvanced2(gradedFVGs, mssArr, getSwingRange(signal)),
    renderAdvanced3(signal, unicorn),
    `---`,
    ``,
    signalRef,
  ].join('\n');
}

module.exports = { buildDiary };
