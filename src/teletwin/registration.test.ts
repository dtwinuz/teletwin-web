import {
  afterEach, beforeEach, describe, expect, it, vi,
} from 'vitest';

// #11: the CorpGate registration flow on the client side. The server half (register -> pending 403, approve ->
// login 200, reject -> 403 rejected) is proven against prod by tests/e2e/specs/write/registration.spec.ts in
// dtwinuz/teletwin; here the same responses drive the client: pending is retried every 15 s, an approval logs in by
// itself, a rejection shows TeleTwinRejected.

const engine = vi.hoisted(() => ({
  telegramUserId: '777',
  credentials: undefined,
  reloadCredentials: vi.fn(),
}));

vi.mock('./engine', () => ({ corpEngine: engine }));
vi.mock('../global', () => ({
  getActions: () => ({}),
  getGlobal: () => ({}),
  setGlobal: vi.fn(),
  withGlobal: () => (component: unknown) => component,
  addActionHandler: vi.fn(),
  addCallback: vi.fn(),
}));
vi.mock('../lib/teact/teactn', () => ({ addCallback: vi.fn() }));

// jsdom has no matchMedia; upstream modules read it at import time
window.matchMedia ??= ((query: string) => ({
  matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined,
})) as unknown as typeof window.matchMedia;

const {
  getPendingRegistration, getRegistrationError, loginToCorp, registerInCorp,
} = await import('./index');
const { loadCredentials, loadPendingRegistration } = await import('./storage');

const SERVER = 'https://tele.example.uz/';
const RETRY_MS = 15000;

type Reply = { status: number; body?: unknown };
let replies: Reply[];
const fetchMock = vi.fn((url: string, init: RequestInit) => {
  const reply = replies.shift();
  if (!reply) throw new Error(`unexpected request ${init.method} ${url}`);
  const text = reply.body === undefined ? '' : JSON.stringify(reply.body);
  return Promise.resolve(new Response(reply.status === 204 ? undefined : text, { status: reply.status }));
});

const LOGIN_OK = {
  status: 200,
  body: { accessToken: 'token-1', cacheKey: 'k', employee: { id: 5, login: 'ali', fullName: 'Ali', isAdmin: false } },
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('fetch', fetchMock);
  localStorage.clear();
  replies = [];
  fetchMock.mockClear();
  engine.credentials = undefined;
  engine.reloadCredentials.mockClear();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function register() {
  replies.push({ status: 202, body: { status: 'pending' } });
  const error = await registerInCorp(SERVER, {
    fullName: ' Ali Valiyev ', login: ' ali ', password: 'secret-pass', note: '',
  });
  expect(error).toBeUndefined();
  const [url, init] = fetchMock.mock.calls[0];
  expect(url).toBe(`${SERVER}api/auth/register`);
  expect(JSON.parse(init.body as string)).toEqual(expect.objectContaining({
    fullName: 'Ali Valiyev', login: 'ali', password: 'secret-pass', telegramUserId: '777',
  }));
  expect(getPendingRegistration()).toEqual({ server: SERVER, login: 'ali', password: 'secret-pass' });
  // survives a reload: the pending registration is stored per Telegram account
  expect(loadPendingRegistration('777')).toEqual(getPendingRegistration());
}

describe('registration -> admin decision', () => {
  it('pending is retried every 15 s; after approval the app logs in by itself', async () => {
    await register();

    replies.push({ status: 403, body: { error: 'pending' } });
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(getPendingRegistration()).toBeDefined();
    expect(loadCredentials('777')).toBeUndefined();

    replies.push(LOGIN_OK);
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toBe(`${SERVER}api/auth/login`);
    expect(loadCredentials('777')).toEqual(expect.objectContaining({ server: SERVER, token: 'token-1' }));
    expect(engine.reloadCredentials).toHaveBeenCalled();
    expect(getPendingRegistration()).toBeUndefined();
    expect(loadPendingRegistration('777')).toBeUndefined();

    // no further retries
    await vi.advanceTimersByTimeAsync(RETRY_MS * 2);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('rejection ends the wait with TeleTwinRejected', async () => {
    await register();

    replies.push({ status: 403, body: { error: 'rejected' } });
    await vi.advanceTimersByTimeAsync(RETRY_MS);
    expect(getRegistrationError()).toBe('TeleTwinRejected');
    expect(getPendingRegistration()).toBeUndefined();
    expect(loadCredentials('777')).toBeUndefined();

    await vi.advanceTimersByTimeAsync(RETRY_MS * 2);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('a taken login is reported, nothing is left pending', async () => {
    replies.push({ status: 409, body: { error: 'login_taken' } });
    const error = await registerInCorp(SERVER, { fullName: 'A', login: 'ali', password: 'secret-pass' });
    expect(error).toBe('TeleTwinErrorLoginTaken');
    expect(getPendingRegistration()).toBeUndefined();
  });

  it('direct login maps the account states', async () => {
    replies.push({ status: 401 });
    expect(await loginToCorp(SERVER, 'ali', 'wrong')).toBe('TeleTwinErrorCredentials');
    replies.push({ status: 403, body: { error: 'rejected' } });
    expect(await loginToCorp(SERVER, 'ali', 'x')).toBe('TeleTwinRejected');
    replies.push({ status: 403, body: { error: 'pending' } });
    expect(await loginToCorp(SERVER, 'ali', 'x')).toBe('TeleTwinPending');
    expect(getPendingRegistration()).toEqual(expect.objectContaining({ login: 'ali' }));
  });
});
