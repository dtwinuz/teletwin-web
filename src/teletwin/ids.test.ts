import { describe, expect, it } from 'vitest';

import {
  APPS_FOLDER_ID, buildCorpChatId, buildCorpGroupMentionId, buildCorpMediaId, buildCorpPollId, buildCorpUserId,
  CORP_FOLDER_ID, CORP_MENTION_ALL_ID, CORP_MENTION_HERE_ID, getCorpDirectChatId, getCorpPollServerId,
  getEmployeeId, getServerChatId, hasCorpMediaReference, isAppsFolderId, isCorpBare, isCorpChatId, isCorpFolderId,
  isCorpMentionKeywordId, isCorpPeerId, isCorpThreadOnlyMessage, isCorpUserId, parseCorpMediaHash,
  registerCorpDirectChat,
} from './ids';

const CORP_BARE_BASE = 2 ** 48 - 2 ** 32;

// Real Telegram ids: a user, a basic group, a supergroup/channel and the largest bare ids Telegram hands out today
const TELEGRAM_IDS = [
  '777000',
  '5000000001',
  '-4123456789',
  '-1001234567890',
  '-1002999999999',
  String(2 ** 40),
  `-${10 ** 12 + 2 ** 40}`,
];

describe('corp chat ids', () => {
  it('matches the documented examples', () => {
    expect(buildCorpChatId(1)).toBe('-282470681743361');
    expect(buildCorpUserId(1)).toBe('281470681743361');
  });

  it.each([1, 2, 42, 1000, 123456, 2 ** 31])('round-trips server chat id %i', (serverChatId) => {
    const chatId = buildCorpChatId(serverChatId);
    expect(isCorpChatId(chatId)).toBe(true);
    expect(isCorpPeerId(chatId)).toBe(true);
    expect(isCorpUserId(chatId)).toBe(false);
    expect(getServerChatId(chatId)).toBe(serverChatId);
  });

  it.each([1, 7, 9999, 2 ** 31])('round-trips employee id %i', (employeeId) => {
    const userId = buildCorpUserId(employeeId);
    expect(isCorpUserId(userId)).toBe(true);
    expect(isCorpPeerId(userId)).toBe(true);
    expect(getEmployeeId(userId)).toBe(employeeId);
    expect(isCorpBare(Number(userId))).toBe(true);
  });

  it('maps a direct chat to the other employee and back', () => {
    registerCorpDirectChat(501, 77);
    const chatId = buildCorpChatId(501);
    expect(chatId).toBe(buildCorpUserId(77));
    expect(isCorpChatId(chatId)).toBe(true);
    expect(getServerChatId(chatId)).toBe(501);
    expect(getCorpDirectChatId(77)).toBe(501);
  });

  it('returns 0 for an employee without a direct chat', () => {
    expect(getServerChatId(buildCorpUserId(31337))).toBe(0);
  });

  it.each(TELEGRAM_IDS)('never claims Telegram id %s', (id) => {
    expect(isCorpChatId(id)).toBe(false);
    expect(isCorpUserId(id)).toBe(false);
    expect(isCorpPeerId(id)).toBe(false);
  });

  it('rejects malformed values', () => {
    expect(isCorpPeerId(undefined)).toBe(false);
    expect(isCorpPeerId('')).toBe(false);
    expect(isCorpPeerId(`-${buildCorpUserId(1)}x`)).toBe(false);
    expect(isCorpPeerId(`${buildCorpUserId(1)}0`)).toBe(false);
    expect(isCorpPeerId(String(2 ** 48))).toBe(false);
  });

  it('keeps the bare range at [2^48 - 2^32, 2^48)', () => {
    expect(isCorpBare(CORP_BARE_BASE - 1)).toBe(false);
    expect(isCorpBare(CORP_BARE_BASE)).toBe(true);
    expect(isCorpBare(2 ** 48 - 1)).toBe(true);
    expect(isCorpBare(2 ** 48)).toBe(false);
  });
});

describe('corp folder id', () => {
  it('is outside the Telegram folder range 2..255', () => {
    expect(CORP_FOLDER_ID).toBeGreaterThan(255);
    expect(isCorpFolderId(CORP_FOLDER_ID)).toBe(true);
    expect(isCorpFolderId(2)).toBe(false);
    expect(isCorpFolderId(undefined)).toBe(false);
  });

  it('treats the apps folder as a local folder too', () => {
    expect(APPS_FOLDER_ID).toBeGreaterThan(255);
    expect(APPS_FOLDER_ID).not.toBe(CORP_FOLDER_ID);
    expect(isCorpFolderId(APPS_FOLDER_ID)).toBe(true);
    expect(isAppsFolderId(APPS_FOLDER_ID)).toBe(true);
    expect(isAppsFolderId(CORP_FOLDER_ID)).toBe(false);
  });
});

describe('corp media ids', () => {
  it('builds and detects media ids', () => {
    expect(buildCorpMediaId('f_1')).toBe('teletwin-corp:f_1');
    expect(buildCorpMediaId('f_1', 't_2')).toBe('teletwin-corp:f_1~t_2');
    expect(hasCorpMediaReference('documentteletwin-corp:f_1')).toBe(true);
    expect(hasCorpMediaReference('document12345')).toBe(false);
  });

  it.each([
    ['documentteletwin-corp:f_1', { fileId: 'f_1', thumbFileId: undefined, query: '' }],
    ['phototeletwin-corp:f_1~t_2?size=x', { fileId: 'f_1', thumbFileId: 't_2', query: 'size=x' }],
    ['https://dtwin.uz/teletwin/web/progressive/documentteletwin-corp:f_9',
      { fileId: 'f_9', thumbFileId: undefined, query: '' }],
  ])('parses %s', (hash, expected) => {
    expect(parseCorpMediaHash(hash)).toEqual(expected);
  });

  it('ignores Telegram media hashes', () => {
    expect(parseCorpMediaHash('photo5123456789?size=x')).toBeUndefined();
    expect(parseCorpMediaHash('document5123456789')).toBeUndefined();
  });
});

describe('corp mention and poll ids', () => {
  it('treats @all, @here and group mentions as keywords, not employees', () => {
    expect(isCorpMentionKeywordId(CORP_MENTION_ALL_ID)).toBe(true);
    expect(isCorpMentionKeywordId(CORP_MENTION_HERE_ID)).toBe(true);
    expect(isCorpMentionKeywordId(buildCorpGroupMentionId(3))).toBe(true);
    expect(isCorpMentionKeywordId(buildCorpUserId(3))).toBe(false);
  });

  it('round-trips poll ids', () => {
    expect(getCorpPollServerId(buildCorpPollId(17))).toBe(17);
    expect(getCorpPollServerId('5123456789')).toBeUndefined();
  });

  it('detects thread-only replies in corp chats only', () => {
    const corpChatId = buildCorpChatId(9);
    const threadReply = { type: 'message', replyToTopId: 5 };
    expect(isCorpThreadOnlyMessage({ chatId: corpChatId, replyInfo: threadReply })).toBe(true);
    expect(isCorpThreadOnlyMessage({ chatId: corpChatId, replyInfo: { type: 'message' } })).toBe(false);
    expect(isCorpThreadOnlyMessage({ chatId: '-1001234567890', replyInfo: threadReply })).toBe(false);
  });
});
