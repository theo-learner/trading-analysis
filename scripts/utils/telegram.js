'use strict';

const RESERVED_RE = /[_*[\]()~`>#+=|{}.!\-\\]/g;

/** Escapes MarkdownV2 reserved characters. */
function escapeMarkdownV2(s) {
  return String(s).replace(RESERVED_RE, '\\$&');
}

/**
 * Sends a message via Telegram Bot API.
 *
 * @param {string} token - Bot token
 * @param {string} chatId - Target chat/channel ID
 * @param {string} text - Message text (MarkdownV2 formatted)
 * @param {{ disableNotification?: boolean }} [opts]
 * @param {Function} [fetchFn] - Injectable fetch (defaults to global fetch)
 * @returns {Promise<{ ok: true, messageId: number }>}
 */
async function sendTelegram(token, chatId, text, opts = {}, fetchFn = fetch) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  const body = {
    chat_id: chatId,
    text,
    parse_mode: 'MarkdownV2',
  };
  if (opts.disableNotification) body.disable_notification = true;

  const resp = await fetchFn(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await resp.json();
  if (!resp.ok) {
    throw new Error(`Telegram API ${resp.status}: ${data.description || 'unknown error'}`);
  }

  return { ok: true, messageId: data.result.message_id };
}

module.exports = { sendTelegram, escapeMarkdownV2 };
