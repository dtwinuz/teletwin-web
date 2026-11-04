import { describe, expect, it } from 'vitest';

import type { GlobalState } from '../global/types';

import { ALL_FOLDER_ID } from '../config';
import { buildCorpAppFrameUrl, getCorpAppIcon, isValidCorpApp } from './apps';
import { APPS_FOLDER_ID, CORP_FOLDER_ID } from './ids';

// Global selectors read `matchMedia` on import, jsdom has none
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
})) as unknown as typeof window.matchMedia;

const { applyAppsFolder, hasCorpData } = await import('./state');

const APP = {
  id: 7, title: 'Faktura', url: 'https://apps.example.uz/faktura', icon: undefined,
};

function buildGlobal(orderedIds: number[], byId: Record<number, unknown> = {}) {
  return { chatFolders: { byId, orderedIds }, chats: { byId: {} } } as unknown as GlobalState;
}

describe('corp apps', () => {
  it('puts the token in the fragment', () => {
    expect(buildCorpAppFrameUrl(APP.url, 'a.b+c/d')).toBe('https://apps.example.uz/faktura#tt=a.b%2Bc%2Fd');
    expect(buildCorpAppFrameUrl('https://apps.example.uz/x?y=1#old', 't')).toBe('https://apps.example.uz/x?y=1#tt=t');
    expect(buildCorpAppFrameUrl('javascript:alert(1)', 't')).toBeUndefined();
  });

  it('accepts only http(s) apps with a title', () => {
    expect(isValidCorpApp(APP)).toBe(true);
    expect(isValidCorpApp({ ...APP, url: 'javascript:alert(1)' })).toBe(false);
    expect(isValidCorpApp({ ...APP, url: 'not a url' })).toBe(false);
    expect(isValidCorpApp({ ...APP, title: ' ' })).toBe(false);
  });

  it('picks an icon the CSP allows', () => {
    expect(getCorpAppIcon({ ...APP, icon: 'data:image/png;base64,AAA' })).toEqual({
      kind: 'image', src: 'data:image/png;base64,AAA',
    });
    expect(getCorpAppIcon({ ...APP, icon: '🧾' })).toEqual({ kind: 'text', text: '🧾' });
    expect(getCorpAppIcon({ ...APP, icon: 'https://cdn.example.uz/icon.png' })).toEqual({ kind: 'text', text: 'F' });
  });
});

describe('apps folder', () => {
  it('goes right after the corp folder', () => {
    const global = applyAppsFolder(buildGlobal([ALL_FOLDER_ID, 2, CORP_FOLDER_ID, 3]), 'Ilovalar');
    expect(global.chatFolders.orderedIds).toEqual([ALL_FOLDER_ID, 2, CORP_FOLDER_ID, APPS_FOLDER_ID, 3]);
    expect(global.chatFolders.byId[APPS_FOLDER_ID]).toMatchObject({
      id: APPS_FOLDER_ID, title: { text: 'Ilovalar' }, emoticon: '🧩', includedChatIds: [],
    });
    expect(hasCorpData(global)).toBe(true);
  });

  it('is appended when there is no corp folder and kept when current', () => {
    const global = applyAppsFolder(buildGlobal([ALL_FOLDER_ID, 2]), 'Ilovalar');
    expect(global.chatFolders.orderedIds).toEqual([ALL_FOLDER_ID, 2, APPS_FOLDER_ID]);
    expect(applyAppsFolder(global, 'Ilovalar')).toBe(global);
  });

  it('is removed when no app is listed', () => {
    const global = applyAppsFolder(buildGlobal([ALL_FOLDER_ID, CORP_FOLDER_ID]), 'Ilovalar');
    const removed = applyAppsFolder(global, undefined);
    expect(removed.chatFolders.orderedIds).toEqual([ALL_FOLDER_ID, CORP_FOLDER_ID]);
    expect(removed.chatFolders.byId[APPS_FOLDER_ID]).toBeUndefined();
    expect(applyAppsFolder(removed, undefined)).toBe(removed);
  });
});
