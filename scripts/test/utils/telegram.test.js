'use strict';

const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { sendTelegram, escapeMarkdownV2 } = require('../../utils/telegram');

// ─── escapeMarkdownV2 ───────────────────────────────────────────────────────

describe('escapeMarkdownV2', () => {
  it('escapes all reserved characters', () => {
    const raw = '_*[]()~`>#+-=|{}.!\\';
    const result = escapeMarkdownV2(raw);
    // Each reserved char must be preceded by backslash
    for (const ch of '_*[]()~`>#+-=|{}.!\\'.split('')) {
      assert.ok(result.includes('\\' + ch), `missing escape for: ${ch}`);
    }
  });

  it('does not double-escape', () => {
    const result = escapeMarkdownV2('hello');
    assert.equal(result, 'hello');
  });

  it('escapes dot in numeric text', () => {
    const result = escapeMarkdownV2('45123.5');
    assert.ok(result.includes('\\.'));
    // comma is NOT a MarkdownV2 reserved char — must not be escaped
    assert.equal(escapeMarkdownV2('1,000'), '1,000');
  });
});

// ─── sendTelegram ───────────────────────────────────────────────────────────

describe('sendTelegram — mockFetch DI', () => {
  it('calls correct URL and body for MarkdownV2', async () => {
    let capturedUrl = null;
    let capturedBody = null;
    const mockFetch = async (url, opts) => {
      capturedUrl = url;
      capturedBody = JSON.parse(opts.body);
      return {
        ok: true,
        json: async () => ({ ok: true, result: { message_id: 42 } }),
      };
    };

    const result = await sendTelegram('TOKEN123', '99999', 'hello world', {}, mockFetch);

    assert.equal(capturedUrl, 'https://api.telegram.org/botTOKEN123/sendMessage');
    assert.equal(capturedBody.chat_id, '99999');
    assert.equal(capturedBody.text, 'hello world');
    assert.equal(capturedBody.parse_mode, 'MarkdownV2');
    assert.deepEqual(result, { ok: true, messageId: 42 });
  });

  it('passes disable_notification when opted in', async () => {
    let capturedBody = null;
    const mockFetch = async (_url, opts) => {
      capturedBody = JSON.parse(opts.body);
      return { ok: true, json: async () => ({ ok: true, result: { message_id: 1 } }) };
    };

    await sendTelegram('T', 'C', 'msg', { disableNotification: true }, mockFetch);
    assert.equal(capturedBody.disable_notification, true);
  });

  it('throws on non-2xx response', async () => {
    const mockFetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ ok: false, description: 'Bad Request' }),
    });

    await assert.rejects(
      () => sendTelegram('TOKEN', 'CHAT', 'text', {}, mockFetch),
      /400/,
    );
  });
});
