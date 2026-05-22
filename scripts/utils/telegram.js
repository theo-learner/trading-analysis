'use strict';

const https = require('https');
const dns   = require('dns');

const RESERVED_RE = /[_*[\]()~`>#+=|{}.!\-\\]/g;

/** Escapes MarkdownV2 reserved characters. */
function escapeMarkdownV2(s) {
  return String(s).replace(RESERVED_RE, '\\$&');
}

// IPv4-forced fetch shim — avoids ETIMEDOUT on hosts where IPv6 is unreachable.
function fetchIPv4(url, init = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const body = init.body || '';
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + (parsed.search || ''),
      method: init.method || 'GET',
      headers: init.headers || {},
      family: 4,
    };
    const req = https.request(options, (res) => {
      let raw = '';
      res.on('data', c => (raw += c));
      res.on('end', () => {
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          json: () => Promise.resolve(JSON.parse(raw)),
        });
      });
    });
    req.setTimeout(10_000, () => req.destroy(new Error('Telegram request timeout')));
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

/**
 * Sends a message via Telegram Bot API.
 *
 * @param {string} token - Bot token
 * @param {string} chatId - Target chat/channel ID
 * @param {string} text - Message text (MarkdownV2 formatted)
 * @param {{ disableNotification?: boolean }} [opts]
 * @param {Function} [fetchFn] - Injectable fetch (defaults to IPv4-forced shim)
 * @returns {Promise<{ ok: true, messageId: number }>}
 */
async function sendTelegram(token, chatId, text, opts = {}, fetchFn = fetchIPv4) {
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
