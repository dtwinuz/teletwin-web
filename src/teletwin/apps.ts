// Corporate web apps of the local "Ilovalar" folder (`GET /api/apps`). They never touch the Telegram API: the list
// comes from the corp server and every app opens in our own iframe overlay with a fresh SSO token.
import type { CorpApp } from './api';

import { createSignal } from '../util/signals';

export type CorpAppsStatus = 'idle' | 'loading' | 'loaded' | 'error';

const RE_HTTP_PROTOCOL = /^https?:$/;
const RE_IMAGE_DATA_URL = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);/i;
const MAX_ICON_TEXT_LENGTH = 4;
const TOKEN_PARAM = 'tt';

const [getCorpApps, setCorpAppsList] = createSignal<CorpApp[]>([]);
const [getCorpAppsStatus, setCorpAppsStatus] = createSignal<CorpAppsStatus>('idle');
// The app shown in the iframe overlay
const [getOpenedCorpApp, setOpenedCorpApp] = createSignal<CorpApp | undefined>();

export {
  getCorpApps, getCorpAppsStatus, getOpenedCorpApp, setCorpAppsStatus, setOpenedCorpApp,
};

export function setCorpApps(apps: CorpApp[]) {
  setCorpAppsList(apps.filter(isValidCorpApp));
}

export function clearCorpApps() {
  setCorpAppsList([]);
  setCorpAppsStatus('idle');
  setOpenedCorpApp(undefined);
}

export function isValidCorpApp(app: CorpApp | undefined): app is CorpApp {
  if (!app || (typeof app.id !== 'number' && typeof app.id !== 'string')) return false;
  if (typeof app.title !== 'string' || !app.title.trim()) return false;

  return parseHttpUrl(app.url) !== undefined;
}

// The token goes in the fragment, so it never reaches server or proxy logs. An existing fragment is replaced.
export function buildCorpAppFrameUrl(url: string, token: string) {
  const parsed = parseHttpUrl(url);
  if (!parsed) return undefined;
  parsed.hash = `${TOKEN_PARAM}=${encodeURIComponent(token)}`;

  return parsed.href;
}

// CSP `img-src` allows only `self`, `data:` and `blob:`: a remote icon URL would not load, so it falls back to text
export function getCorpAppIcon(app: CorpApp): { kind: 'image'; src: string } | { kind: 'text'; text: string } {
  const icon = app.icon?.trim();
  if (icon && RE_IMAGE_DATA_URL.test(icon)) return { kind: 'image', src: icon };
  if (icon && [...icon].length <= MAX_ICON_TEXT_LENGTH) return { kind: 'text', text: icon };

  return { kind: 'text', text: [...app.title.trim()][0]?.toUpperCase() ?? '?' };
}

function parseHttpUrl(url: unknown) {
  if (typeof url !== 'string') return undefined;
  try {
    const parsed = new URL(url);
    return RE_HTTP_PROTOCOL.test(parsed.protocol) ? parsed : undefined;
  } catch {
    return undefined;
  }
}
