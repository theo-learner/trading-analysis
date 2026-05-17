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
  const { pair, direction, tier, confidence, entry, sl, tp, analysisDate } = signal;

  const tpLines = Array.isArray(tp)
    ? tp.map((t, i) => `TP${i + 1}: ${esc(t.toFixed(1))}`).join('\n')
    : `TP: ${esc(String(tp))}`;

  const poiLabel = entry?.poi ? ` \\(${esc(entry.poi)}\\)` : '';
  const killzone = entry?.killzone ? `\n세션: ${esc(entry.killzone)}` : '';
  const rrStr = signal.rr ? `\nRR: ${esc(signal.rr.toFixed(2))}` : '';

  return [
    `*ICT 진입 시그널* — ${esc(pair)}`,
    '',
    `방향: ${esc(direction)}`,
    `티어: Tier ${esc(String(tier))} \\(${esc(confidence)}\\)`,
    `진입: ${esc(entry?.price?.toFixed(1) ?? '?')}${poiLabel}`,
    `SL: ${esc(sl?.toFixed(1) ?? '?')}`,
    tpLines,
    `${rrStr}`,
    '',
    `분석일: ${esc(analysisDate)}${killzone}`,
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();
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
      return { sent: false, skipped: 'rejected' };
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
