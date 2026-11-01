import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import { buildCorpChatId, buildCorpMediaId, buildCorpUserId, CORP_FOLDER_ID } from './ids';

const IMPLEMENTED = new Set(['sendMessage', 'fetchMessages']);
const callCorpMethod = vi.fn((fnName: string) => (IMPLEMENTED.has(fnName) ? Promise.resolve('corp') : undefined));

vi.mock('./provider', () => ({ callCorpMethod: (fnName: string, args: unknown[]) => callCorpMethod(fnName, args) }));

const { getApiRouteCounts, routeApiCall } = await import('./guard');

const CORP_CHAT_ID = buildCorpChatId(4);
const CORP_USER_ID = buildCorpUserId(8);
const TELEGRAM_CHAT = { id: '-1001234567890', type: 'chatTypeSuperGroup' };

describe('routeApiCall', () => {
  beforeEach(() => {
    callCorpMethod.mockClear();
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });

  it('passes Telegram-only calls through unchanged', () => {
    const args = [{ chat: TELEGRAM_CHAT, text: 'salom', userId: '5000000001' }];
    expect(routeApiCall('sendMessage', args)).toEqual({ kind: 'telegram', args });
    expect(callCorpMethod).not.toHaveBeenCalled();
  });

  it.each([
    ['string chat id', [{ chat: { id: CORP_CHAT_ID } }]],
    ['string user id', [{ peer: { id: CORP_USER_ID } }]],
    ['number bare id', [{ userId: Number(CORP_USER_ID) }]],
    ['bigint bare id', [{ userId: BigInt(CORP_USER_ID) }]],
    ['nested object', [{ a: { b: { c: { chatId: CORP_CHAT_ID } } } }]],
    ['array item', [{ chats: [TELEGRAM_CHAT, { id: CORP_CHAT_ID }] }]],
    ['top-level argument', [CORP_CHAT_ID]],
    ['media hash', [{ url: `document${buildCorpMediaId('f_1')}` }]],
  ])('routes a corp reference in a %s to the provider', (_, args) => {
    const result = routeApiCall('sendMessage', args);
    expect(result.kind).toBe('corp');
    expect(callCorpMethod).toHaveBeenCalledWith('sendMessage', args);
  });

  it.each([
    ['string', [{ chat: { id: CORP_CHAT_ID } }]],
    ['number', [{ userId: Number(CORP_USER_ID) }]],
    ['bigint', [{ userId: BigInt(CORP_USER_ID) }]],
    ['nested array', [[[{ peerId: CORP_USER_ID }]]]],
  ])('blocks a corp %s reference the provider does not implement', (_, args) => {
    const before = getApiRouteCounts().blocked;
    expect(routeApiCall('reportPeer', args)).toEqual({ kind: 'blocked' });
    expect(getApiRouteCounts().blocked).toBe(before + 1);
  });

  it('blocks the corp folder id only for folder methods', () => {
    expect(routeApiCall('editChatFolder', [{ id: CORP_FOLDER_ID }]).kind).toBe('blocked');
    expect(routeApiCall('fetchChatlistInvites', [{ folderId: CORP_FOLDER_ID }]).kind).toBe('blocked');
    expect(routeApiCall('fetchMessages', [{ limit: CORP_FOLDER_ID }]).kind).toBe('telegram');
  });

  it('removes the corp folder from sortChatFolders', () => {
    expect(routeApiCall('sortChatFolders', [[2, CORP_FOLDER_ID, 3], 'x'])).toEqual({
      kind: 'telegram',
      args: [[2, 3], 'x'],
    });
    expect(routeApiCall('sortChatFolders', [[2, 3]])).toEqual({ kind: 'telegram', args: [[2, 3]] });
  });

  it('does not look inside class instances', () => {
    class Wrapper {
      chatId = CORP_CHAT_ID;
    }
    expect(routeApiCall('sendMessage', [new Wrapper()]).kind).toBe('telegram');
  });

  it('survives circular references', () => {
    const value: Record<string, unknown> = { text: 'x' };
    value.self = value;
    expect(routeApiCall('sendMessage', [value]).kind).toBe('telegram');
    value.chatId = CORP_CHAT_ID;
    expect(routeApiCall('sendMessage', [value]).kind).toBe('corp');
  });
});
