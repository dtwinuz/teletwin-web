import {
  beforeEach, describe, expect, it, vi,
} from 'vitest';

import type { ApiChat, ApiMessage } from '../api/types';

import { buildCorpChatId } from './ids';

// #9: a corp message never leaves for a Telegram chat. The UI action (setForwardChatOrTopic) refuses it first; this
// is the second line in the corp provider, which would otherwise forward through the corp server.

const showNotification = vi.fn();
const forwardCorpMessages = vi.fn((..._args: unknown[]) => Promise.resolve<unknown[]>([]));
const applyLive = vi.fn();

vi.mock('../global', () => ({
  getActions: () => ({ showNotification }),
  getGlobal: () => ({ byTabId: { 1: { id: 1 }, 2: { id: 2 } } }),
  setGlobal: vi.fn(),
  withGlobal: () => (component: unknown) => component,
  addActionHandler: vi.fn(),
  addCallback: vi.fn(),
}));
vi.mock('./engine', () => ({
  corpEngine: { credentials: { server: 'https://tele.example.uz/', token: 'token' }, applyLive },
}));
vi.mock('./api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./api')>()),
  forwardCorpMessages: (...args: unknown[]) => forwardCorpMessages(...args),
}));

// jsdom has no matchMedia; upstream modules read it at import time
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
})) as unknown as typeof window.matchMedia;

const { corpMethods } = await import('./provider');

const corpChat = (id: number) => ({ id: buildCorpChatId(id) }) as ApiChat;
const telegramChat = { id: '123456789' } as ApiChat;
const messages = [{ id: 11 }, { id: 12 }] as ApiMessage[];

beforeEach(() => {
  showNotification.mockClear();
  forwardCorpMessages.mockClear();
});

describe('forwardMessages', () => {
  it('corp -> Telegram is blocked with a notice in every tab and nothing is sent', async () => {
    await corpMethods.forwardMessages!({ fromChat: corpChat(4), toChat: telegramChat, messages });
    expect(forwardCorpMessages).not.toHaveBeenCalled();
    expect(showNotification).toHaveBeenCalledTimes(2);
    expect(showNotification).toHaveBeenCalledWith({ message: { key: 'TeleTwinForwardOutBlocked' }, tabId: 1 });
  });

  it('corp -> corp goes through the corp server with server ids and keeps the origin', async () => {
    forwardCorpMessages.mockResolvedValueOnce([{ id: 99 }]);
    await corpMethods.forwardMessages!({ fromChat: corpChat(4), toChat: corpChat(7), messages });
    expect(showNotification).not.toHaveBeenCalled();
    expect(forwardCorpMessages).toHaveBeenCalledWith('https://tele.example.uz/', 'token', 7, 4, [11, 12]);
    expect(applyLive).toHaveBeenCalledWith({ id: 99 });
  });
});
