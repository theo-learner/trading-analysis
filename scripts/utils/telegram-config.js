'use strict';

const fs = require('node:fs');
const path = require('node:path');

const SESSION_DIR = path.join(__dirname, '..', '..', 'sessions');

/**
 * Loads Telegram credentials.
 * Token from sessions/telegram-bot-token.txt (mirrors coinalyze-api-key.txt pattern).
 * ChatId from traderConfig.notifications.telegram.chatId.
 *
 * @param {object} traderConfig
 * @returns {{ token: string, chatId: string }}
 * @throws {Error} if token file missing or chatId not configured
 */
function loadTelegramCredentials(traderConfig) {
  const tokenPath = path.join(SESSION_DIR, 'telegram-bot-token.txt');
  if (!fs.existsSync(tokenPath)) {
    throw new Error(`Telegram token file not found: ${tokenPath}`);
  }
  const token = fs.readFileSync(tokenPath, 'utf-8').trim();
  if (!token) {
    throw new Error('Telegram token file is empty');
  }

  const chatIdPath = path.join(SESSION_DIR, 'telegram-chat-id.txt');
  if (!fs.existsSync(chatIdPath)) {
    throw new Error(`Telegram chatId file not found: ${chatIdPath}`);
  }
  const chatId = fs.readFileSync(chatIdPath, 'utf-8').trim();
  if (!chatId) {
    throw new Error('Telegram chatId file is empty');
  }

  return { token, chatId };
}

module.exports = { loadTelegramCredentials };
