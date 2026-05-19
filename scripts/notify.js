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
 * @returns {string}
 */
function formatMessage(signal, verdict) {
  const esc = escapeMarkdownV2;
  const { pair, direction, tier, confidence, entry, sl, tp, rr, currentPrice } = signal;

  const dirEmoji = direction === 'LONG' ? '📈' : direction === 'SHORT' ? '📉' : '➡️';
  const ep = entry?.price ?? 0;

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
  function distToEntry() {
    if (!currentPrice || !ep) return '';
    const d = (ep - currentPrice) / currentPrice * 100;
    const arrow = d >= 0 ? '↑' : '↓';
    return `  ${arrow}${Math.abs(d).toFixed(1)}% 진입까지`;
  }

  const tpLines = Array.isArray(tp)
    ? tp.map((t, i) => `TP${i + 1}    \\$${esc(fmt(t))}${esc(pct(t))}`).join('\n')
    : `TP      \\$${esc(fmt(tp))}`;

  const poi = entry?.poi ? esc(entry.poi) : '';
  const kz  = entry?.killzone
    ? ` · ${esc(entry.killzone.charAt(0).toUpperCase() + entry.killzone.slice(1))}`
    : '';

  const kst = new Date(Date.now() + 9 * 3_600_000);
  const pad = n => String(n).padStart(2, '0');
  const timeStr = `${pad(kst.getUTCMonth() + 1)}\\-${pad(kst.getUTCDate())} ${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())} KST`;

  const curLine = currentPrice
    ? `현재가  \\$${esc(fmt(currentPrice))}${esc(distToEntry())}\n`
    : '';

  return [
    `${dirEmoji} *${direction}  ${esc(pair)}*  \\|  Tier ${esc(String(tier))} · ${esc(confidence)}`,
    '',
    `${curLine}진입    \\$${esc(fmt(ep))}`,
    `SL      \\$${esc(fmt(sl ?? 0))}${esc(pct(sl))}`,
    tpLines,
    `R:R     ${esc(rr?.toFixed(2) ?? '?')}`,
    '',
    `🎯 ${poi}${kz}`,
    `🕐 ${timeStr}`,
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

    // 3. Signal quality gate
    const verdict = judgeFn(signal);
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
    const message = formatMessage(signal, verdict);

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

module.exports = { notifySignal, formatMessage };
