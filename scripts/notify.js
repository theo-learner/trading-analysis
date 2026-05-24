'use strict';

const { judgeSignal } = require('./signal-judge');
const { sendTelegram, escapeMarkdownV2 } = require('./utils/telegram');
const { loadTelegramCredentials } = require('./utils/telegram-config');
const { dedupKey, hasRecentNotification, recordNotification } = require('./utils/notification-ledger');

/**
 * Formats signal + verdict into a MarkdownV2 Telegram message.
 * Korean labels, English terminology (LONG/SHORT, Tier, POI type).
 *
 * @param {object} signal
 * @param {object} verdict
 * @param {object} [tradeResult]
 * @returns {string}
 */
function formatMessage(signal, verdict, tradeResult) {
  const esc = escapeMarkdownV2;
  const { pair, direction, tier, confidence, entry, sl, tp, rr, currentPrice, scorecard, structure } = signal;

  const dirEmoji = direction === 'LONG' ? '📈' : direction === 'SHORT' ? '📉' : '➡️';
  const ep = entry?.price ?? 0;

  // All display prices use signal entry price — actual filled shown in trade lines below

  // 천 단위 쉼표, 불필요한 .0 제거
  function fmt(n) {
    if (!Number.isFinite(n)) return '?';
    const s = Number.isInteger(n) ? n.toFixed(0) : n.toFixed(n < 10 ? 4 : n < 1000 ? 2 : 1);
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function pct(target) {
    if (!ep || !target) return '';
    const d = (target - ep) / ep * 100;
    return ` (${d >= 0 ? '+' : ''}${d.toFixed(1)}%)`;
  }

  // 현재가 → 진입가 방향 표시
  // LONG: arrow always ↓ (limit entry direction). Already in POI if current < entry.
  // SHORT: arrow always ↑. Already in POI if current > entry.
  function distToEntry() {
    if (!currentPrice || !ep) return '';
    const absPct = Math.abs((ep - currentPrice) / currentPrice * 100).toFixed(1);
    if (direction === 'LONG') {
      return ep <= currentPrice ? `  ↓${absPct}% 진입까지` : `  ↓${absPct}% 진입 중`;
    }
    if (direction === 'SHORT') {
      return ep >= currentPrice ? `  ↑${absPct}% 진입까지` : `  ↑${absPct}% 진입 중`;
    }
    const arrow = ep >= currentPrice ? '↑' : '↓';
    return `  ${arrow}${absPct}% 진입까지`;
  }

  // Tier 설명
  function tierLabel(t) {
    if (t === 1) return 'HTF\\+LTF 정렬 \\+ BOS';
    if (t === 2) return 'HTF\\+LTF 정렬';
    if (t === 3) return 'LTF 횡보';
    return `Tier ${t}`;
  }

  // 직관적 해석 한 줄 생성
  function buildSummary() {
    const htf = structure?.htfTrend ?? '?';
    const ltf = structure?.ltfTrend ?? '?';
    const ote = scorecard?.oteZone ?? '';
    const bd  = scorecard?.breakdown ?? {};

    const htfStr  = htf === 'bull' ? '상승추세' : htf === 'bear' ? '하락추세' : '횡보';
    const ltfStr  = ltf === 'bull' ? '상승' : ltf === 'bear' ? '하락' : '횡보';
    const oteStr  = ote === 'OTE' ? 'OTE 구간' : ote === 'SHALLOW' ? '얕은 되돌림' : ote === 'DEEP' ? '깊은 되돌림' : 'OTE 미확인';
    const kzStr   = bd.time  ? '킬존 ✓' : '킬존 외';
    const liqStr  = bd.liquidity ? '스윕 ✓' : '스윕 미확인';
    const pdStr   = bd.pdArray >= 2 ? 'PD 복합' : bd.pdArray === 1 ? 'PD 단일' : 'PD 없음';

    return esc(`HTF ${htfStr} / LTF ${ltfStr} / ${oteStr} / ${kzStr} / ${liqStr} / ${pdStr}`);
  }

  const tpBasis = signal.tpBasis ?? [];
  const tpLines = Array.isArray(tp)
    ? tp.map((t, i) => {
        const tag = tpBasis[i] === 'RR' ? ' · RR' : tpBasis[i] === 'ERL' ? ' · ERL' : '';
        return `TP${i + 1}    \\$${esc(fmt(t))}${esc(pct(t))}${esc(tag)}`;
      }).join('\n')
    : `TP      \\$${esc(fmt(tp))}`;

  const poi = entry?.basis?.trim() ? esc(entry.basis) : 'POI_RETEST';
  const kz  = entry?.killzone
    ? ` · ${esc(entry.killzone.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '))}`
    : '';

  const grade = scorecard?.grade ?? '?';
  const size  = scorecard?.sizeMultiplier != null ? scorecard.sizeMultiplier : '?';

  const kst = new Date(Date.now() + 9 * 3_600_000);
  const pad = n => String(n).padStart(2, '0');
  const timeStr = `${pad(kst.getUTCMonth() + 1)}\\-${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())} KST`;

  const curLine = currentPrice
    ? `현재가  \\$${esc(fmt(currentPrice))}${esc(distToEntry())}\n`
    : '';

  const rrLabel = rr != null && Number.isFinite(rr)
    ? `R:${esc(String(rr.toFixed(2)))}`
    : 'R:R ?';

  const tradeLines = _buildTradeLines(tradeResult, esc, fmt);

  return [
    `${dirEmoji} *${direction}  ${esc(pair)}*  \\|  Tier ${esc(String(tier))} · ${esc(confidence)}`,
    `_${tierLabel(tier)}_  \\|  Grade *${esc(grade)}*  \\|  Size ${esc(String(size))}x`,
    '',
    `${curLine}진입    \\\\$${esc(fmt(ep))}`,
    `SL      \\\\$${esc(fmt(sl ?? 0))}${esc(pct(sl))}`,
    tpLines,
    `${rrLabel}`,
    '',
    `💡 ${buildSummary()}`,
    `🎯 ${poi}${kz}`,
    `🕐 ${timeStr}`,
    ...(tradeLines ? ['', tradeLines] : []),
  ].join('\n');
}

/**
 * Orchestrates Telegram notification for an ICT signal.
 *
 * All failures are caught and returned — the trading flow is never blocked.
 *
 * @param {object} signal - ICTSignal from ict-engine.js
 * @param {object} traderConfig - parsed trader.json
 * @param {{
 *   judgeFn?: Function,
 *   sendFn?: Function,
 *   loadCredentialsFn?: Function,
 *   env?: object,
 *   ledgerPath?: string,
 *   verdict?: object,    // pre-computed judgeSignal result — skips internal judgeFn call
 *   tradeResult?: object, // trade execution result to include in message
 * }} [opts]
 * @returns {Promise<{ sent: boolean, skipped?: string, error?: string }>}
 */
async function notifySignal(signal, traderConfig, opts = {}) {
  const {
    judgeFn = judgeSignal,
    sendFn = sendTelegram,
    loadCredentialsFn = loadTelegramCredentials,
    env = process.env,
    ledgerPath,
    verdict: precomputedVerdict,
    tradeResult,
  } = opts;

  // Inject test ledger path if provided
  const prevLedgerPath = process.env._TEST_LEDGER_PATH;
  if (ledgerPath) process.env._TEST_LEDGER_PATH = ledgerPath;

  try {
    // 1. Enabled check
    if (!traderConfig?.notifications?.telegram?.enabled) {
      return { sent: false, skipped: 'disabled' };
    }

    // 2. Env gate — only cron/launchd sets TELEGRAM_NOTIFY=1
    if (env.TELEGRAM_NOTIFY !== '1') {
      return { sent: false, skipped: 'env_gate' };
    }

    // 2.5. Size gate — only send 1x signals (0.5x / 0x are no-trade)
    const size = signal?.scorecard?.sizeMultiplier;
    if (size != null && size !== 1) {
      return { sent: false, skipped: 'size', reason: `Size ${size}x — 알림 제외` };
    }

    // 3. Signal quality gate (use pre-computed verdict if provided)
    const verdict = precomputedVerdict ?? judgeFn(signal);
    if (!verdict.approved) {
      return { sent: false, skipped: 'rejected', reason: verdict.reason };
    }

    // 4. Dedup check
    const key = dedupKey(signal);
    if (hasRecentNotification(key)) {
      return { sent: false, skipped: 'duplicate' };
    }

    // 5. Credentials
    let credentials;
    try {
      credentials = loadCredentialsFn(traderConfig);
    } catch (e) {
      return { sent: false, skipped: 'no_credentials', error: e.message };
    }

    // 6. Format message
    const message = formatMessage(signal, verdict, tradeResult);

    // 7. Send
    let messageId;
    try {
      const result = await sendFn(credentials.token, credentials.chatId, message, {
        disableNotification: false,
      });
      messageId = result.messageId;
    } catch (e) {
      return { sent: false, skipped: 'error', error: e.message };
    }

    // 8. Record to ledger
    recordNotification(key, {
      pair: signal.pair,
      direction: signal.direction,
      tier: signal.tier,
      messageId,
    });

    return { sent: true };

  } finally {
    // Restore previous ledger path
    if (ledgerPath) {
      if (prevLedgerPath !== undefined) {
        process.env._TEST_LEDGER_PATH = prevLedgerPath;
      } else {
        delete process.env._TEST_LEDGER_PATH;
      }
    }
  }
}

function _buildTradeLines(tradeResult, esc, fmt) {
  if (!tradeResult) return null;
  const { dryRun, preflightFailed, slFailed, id, entry, qty, riskCheck, reason } = tradeResult;
  if (preflightFailed) {
    return `⚠️ 주문 건너뜀: ${esc(reason ?? '미상')}`;
  }
  if (slFailed) {
    return `🚨 SL 배치 실패 → 비상 청산`;
  }
  const modeTag = dryRun ? '\\[dry\\-run\\]' : '\\[LIVE\\]';
  const filledLine = entry?.filled
    ? `체결가 \\$${esc(fmt(entry.filled))} · slip ${esc(String(entry.slippageBps ?? 0))}bps`
    : '';
  const qtyLine  = qty  ? `수량 ${esc(String(qty))}` : '';
  const idLine   = id   ? `주문ID ${esc(id)}` : '';
  const balLine  = riskCheck?.balanceUsd != null ? `잔액 \\$${esc(String(riskCheck.balanceUsd))}` : '';
  return [
    `📋 ${modeTag} 주문 접수`,
    filledLine, qtyLine, idLine, balLine,
  ].filter(Boolean).join('\n');
}

module.exports = { notifySignal, formatMessage };
