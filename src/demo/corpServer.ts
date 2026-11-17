// Demo-only in-memory TeleTwin corp server. It answers `fetch` and the upload `XMLHttpRequest` for
// `DEMO_CORP_SERVER/api/...` (the REST API of `src/teletwin/api.ts`) and feeds the fake hub (`./signalr.ts`).
// State lives in memory and resets on reload.
import type {
  CorpActivityItem, CorpChatInfo, CorpDirectoryChat, CorpEntity, CorpMember, CorpMessage, CorpPoll,
  CorpReaction, CorpSavedItem, CorpScheduledMessage,
} from '../teletwin/api';
import type { DemoChat, DemoEmployee, DemoLine } from './data';

import {
  ago, ahead, DAY, DEMO_CORP_SERVER, DEMO_EMPLOYEE_ID, getScript, HOUR, JIRA_BASE_URL, JIRA_ISSUES, KIND_CHANNEL,
  KIND_DIRECT, LIVE_LINES, makeApps, makeChats, makeEmployees, makeGroups, MINUTE,
} from './data';
import { buildDemoFile, type DemoFile } from './files';

type HubListener = (event: string, payload: unknown) => void;

interface StoredMessage extends CorpMessage {
  reactionIds: Record<string, number[]>;
  pollVotes?: Record<number, number[]>;
}

interface StoredPoll extends Omit<CorpPoll, 'totalVoters' | 'options'> {
  options: { id: number; text: string; voterIds: number[] }[];
}

interface DemoState {
  lastReadId: Record<number, number>;
  notify: Record<number, { notifyLevel: 'all' | 'mentions' | 'none'; mutedUntil?: string }>;
}

const API_PREFIX = `${DEMO_CORP_SERVER}api/`;
const HTTP_OK = 200;
const HTTP_NO_CONTENT = 204;
const HTTP_BAD_REQUEST = 400;
const HTTP_UNAUTHORIZED = 401;
const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;
const MIN_LATENCY = 60;
const LATENCY_SPREAD = 120;
const REPLY_DELAY = 2600;
const TYPING_DELAY = 900;
const LIVE_FIRST_DELAY = 9000;
const LIVE_EVERY_DELAY = 21000;
const MAX_LIMIT = 200;
const RECENT_REPLIERS = 3;

export const DEMO_TOKEN = 'demo-session-token';
const ME = DEMO_EMPLOYEE_ID;

const employees: DemoEmployee[] = makeEmployees();
const chats: DemoChat[] = makeChats(employees);
const groups = makeGroups(employees);
const apps = makeApps();
const messages: StoredMessage[] = [];
const polls = new Map<number, StoredPoll>();
const files = new Map<string, DemoFile | Blob>();
const scheduled: CorpScheduledMessage[] = [];
const saved: CorpSavedItem[] = [];
const state: DemoState = { lastReadId: {}, notify: {} };
const readMaxByOthers: Record<number, number> = {};
const pinsByChat: Record<number, number[]> = {};
const threadRead: Record<string, number> = {};
const listeners = new Set<HubListener>();

let nextId = 1000;
let nextPollId = 1;
let liveIndex = 0;

export const DEMO_EMPLOYEE = employees.find((e) => e.id === ME)!;

export function onDemoHub(listener: HubListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: string, payload: unknown) {
  listeners.forEach((listener) => listener(event, payload));
}

// ---- seeding ----

function seed() {
  const lines: { chat: DemoChat; line: DemoLine; at: number; index: number; total: number }[] = [];
  chats.forEach((chat) => {
    const script = getScript(chat.id);
    const spanDays = chat.kind === KIND_CHANNEL ? 24 : (chat.kind === KIND_DIRECT ? 4 : 8);
    script.forEach((line, index) => {
      const fromEnd = script.length - 1 - index;
      // The newest line of a chat is minutes old, older ones spread over days; chats do not line up
      const age = (fromEnd / Math.max(1, script.length)) * spanDays * DAY
        + ((chat.id * 37 + index * 13) % 50) * MINUTE + chat.id * 6 * MINUTE + 2 * MINUTE;
      lines.push({
        chat, line, at: Date.now() - age, index, total: script.length,
      });
    });
  });
  lines.sort((a, b) => a.at - b.at);

  const idsByChat: Record<number, number[]> = {};
  lines.forEach(({ chat, line, at }) => {
    const chatIds = (idsByChat[chat.id] ||= []);
    const id = nextId++;
    const replyToId = line.reply ? chatIds[chatIds.length - line.reply] : undefined;
    const message = createMessage(chat.id, line.from, line.text, new Date(at).toISOString(), {
      replyToId,
      entities: line.entities || buildAutoEntities(line.text),
    }, id);
    chatIds.push(id);
    if (line.media) {
      const fileId = `${line.media.file}-${id}`;
      const { file, label, colors, ...media } = line.media;
      files.set(fileId, {
        kind: media.kind, label, colors, mime: media.mime, fileName: media.fileName, duration: media.duration,
        width: media.width, height: media.height,
      });
      message.media = { ...media, fileId };
      if (media.kind === 'voice') message.media.waveform = buildWaveform(id, media.duration || 1);
    }
    if (line.edited) message.editedAt = new Date(at + 4 * MINUTE).toISOString();
    if (line.forward) {
      message.forward = { senderName: line.forward.senderName, sentAt: new Date(at - HOUR).toISOString() };
    }
    if (line.reactions) message.reactionIds = { ...line.reactions };
    if (line.pin) (pinsByChat[chat.id] ||= []).push(id);
    if (line.poll) {
      const poll: StoredPoll = {
        id: nextPollId++,
        question: line.poll.question,
        isAnonymous: Boolean(line.poll.isAnonymous),
        isMultiple: Boolean(line.poll.isMultiple),
        isClosed: Boolean(line.poll.isClosed),
        closesAt: line.poll.closesInMs ? ahead(line.poll.closesInMs) : undefined,
        options: line.poll.options.map(([text, voterIds], index) => ({ id: index + 1, text, voterIds: [...voterIds] })),
      };
      polls.set(poll.id, poll);
      message.poll = buildPoll(poll);
    }
    messages.push(message);
    line.thread?.forEach(([from, text], index) => {
      const reply = createMessage(chat.id, from, text, new Date(at + (index + 1) * 7 * MINUTE).toISOString(), {
        threadRootId: id,
      });
      messages.push(reply);
    });
  });

  // Read positions: a few chats keep unread messages, so the folder shows counters and mention badges
  const unread: Record<number, number> = {
    1: 3, 2: 5, 6: 2, 9: 1, 11: 2, 21: 1, 20: 1,
  };
  chats.forEach((chat) => {
    const ids = idsByChat[chat.id] || [];
    const unreadCount = unread[chat.id] || 0;
    state.lastReadId[chat.id] = ids.length ? ids[Math.max(0, ids.length - 1 - unreadCount)] : 0;
    if (unreadCount >= ids.length) state.lastReadId[chat.id] = 0;
    readMaxByOthers[chat.id] = ids[ids.length - 1] || 0;
  });
  // The last own DM message to Akmal Karimov is still unread by him: a single check mark
  const lastDirect = idsByChat[20] || [];
  readMaxByOthers[20] = lastDirect[lastDirect.length - 2] || 0;
  state.notify[11] = { notifyLevel: 'mentions' };
  state.notify[13] = { notifyLevel: 'all', mutedUntil: ahead(8 * HOUR) };
  state.notify[8] = { notifyLevel: 'none' };

  seedScheduled();
  seedSaved();
}

function seedScheduled() {
  scheduled.push({
    id: nextId++,
    chatId: 2,
    sendAt: ahead(DAY - 6 * HOUR),
    createdAt: ago(HOUR),
    text: 'Ertalabki eslatma: bugun "Yashil Vodiy" shartnomasini imzolaymiz, 11:00, majlislar zali.',
  }, {
    id: nextId++,
    chatId: 2,
    sendAt: ahead(3 * DAY),
    createdAt: ago(2 * HOUR),
    text: 'Haftalik savdo hisobotini CRM\'ga kiritishni unutmang 📊',
  }, {
    id: nextId++,
    chatId: 18,
    sendAt: ahead(2 * DAY),
    createdAt: ago(30 * MINUTE),
    text: 'Nilufar opa, akt sverka ilovada.',
  });
}

function seedSaved() {
  const pick = (chatId: number, fromEnd: number) => {
    const list = messages.filter((m) => m.chatId === chatId && !m.threadRootId);
    return list[list.length - 1 - fromEnd];
  };
  const items: [StoredMessage | undefined, string | undefined, string | undefined][] = [
    [pick(2, 4), ahead(2 * HOUR), undefined],
    [pick(1, 4), undefined, undefined],
    [pick(4, 1), ahead(DAY), undefined],
    [pick(5, 6), ago(3 * HOUR), ago(3 * HOUR)],
    [pick(17, 0), ahead(3 * DAY), undefined],
  ];
  items.forEach(([message, remindAt, remindedAt], index) => {
    if (!message) return;
    saved.push({
      id: index + 1,
      messageId: message.id,
      chatId: message.chatId,
      remindAt,
      remindedAt,
      createdAt: ago((index + 1) * 5 * HOUR),
    });
  });
}

function createMessage(
  chatId: number, senderId: number, text: string, sentAt: string, extra: Partial<CorpMessage> = {}, id = nextId++,
): StoredMessage {
  const sender = employees.find((e) => e.id === senderId)!;

  return {
    id,
    chatId,
    senderId,
    senderName: sender.fullName,
    text,
    sentAt,
    reactionIds: {},
    ...extra,
  };
}

// `@login` and `@group` stay plain text on the wire (the server parses them); Jira keys become links client-side
function buildAutoEntities(text: string): CorpEntity[] | undefined {
  const entities: CorpEntity[] = [];
  const re = /\d[\d ]{2,}\d so'm/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    entities.push({ type: 'bold', offset: match.index, length: match[0].length });
  }

  return entities.length ? entities : undefined;
}

const WAVEFORM_SAMPLES = 63;
const WAVEFORM_MAX = 31;

function buildWaveform(shift: number, duration: number) {
  const values = Array.from({ length: WAVEFORM_SAMPLES }, (_, i) => {
    const wave = Math.abs(Math.sin((i + shift) * 0.7) * Math.cos(i * 0.23 + duration));
    return Math.round(4 + wave * (WAVEFORM_MAX - 4));
  });

  return btoa(String.fromCharCode(...values));
}

// ---- DTOs ----

function buildPoll(poll: StoredPoll, viewerId = ME): CorpPoll {
  const voters = new Set(poll.options.flatMap((option) => option.voterIds));
  const isClosed = poll.isClosed || Boolean(poll.closesAt && Date.parse(poll.closesAt) < Date.now());

  return {
    id: poll.id,
    question: poll.question,
    isAnonymous: poll.isAnonymous,
    isMultiple: poll.isMultiple,
    closesAt: poll.closesAt,
    isClosed,
    totalVoters: voters.size,
    options: poll.options.map((option) => ({
      id: option.id,
      text: option.text,
      votes: option.voterIds.length,
      chosen: option.voterIds.includes(viewerId),
      voterIds: poll.isAnonymous ? undefined : [...option.voterIds],
    })),
  };
}

function buildReactions(message: StoredMessage): CorpReaction[] {
  return Object.entries(message.reactionIds)
    .filter(([, ids]) => ids.length)
    .map(([emoji, ids]) => ({
      emoji, count: ids.length, mine: ids.includes(ME), employeeIds: [...ids],
    }));
}

function buildMessageDto(message: StoredMessage): CorpMessage {
  const { reactionIds, pollVotes, ...dto } = message;
  void pollVotes;
  const replies = messages.filter((m) => m.threadRootId === message.id && m.chatId === message.chatId);
  const poll = message.poll ? polls.get(message.poll.id) : undefined;

  return {
    ...dto,
    reactions: buildReactions(message),
    isPinned: pinsByChat[message.chatId]?.includes(message.id) || undefined,
    poll: poll ? buildPoll(poll) : undefined,
    thread: replies.length ? {
      replyCount: replies.length,
      lastReplyAt: replies[replies.length - 1].sentAt,
      recentReplierIds: [...new Set(replies.map((r) => r.senderId).reverse())].slice(0, RECENT_REPLIERS),
      lastReadId: threadRead[`${message.chatId}:${message.id}`] || 0,
    } : undefined,
  };
}

function isMember(chat: DemoChat, employeeId = ME) {
  return chat.memberIds.includes(employeeId);
}

function getPeerId(chat: DemoChat) {
  return chat.memberIds.find((id) => id !== ME);
}

function isMentioningMe(message: StoredMessage) {
  if (message.senderId === ME) return false;
  if (message.entities?.some((entity) => entity.employeeId === ME)) return true;
  const text = message.text.toLowerCase();
  if (text.includes(`@${DEMO_EMPLOYEE.login}`) || text.includes('@all') || text.includes('@here')) return true;

  return groups.some((group) => group.memberIds.includes(ME) && text.includes(`@${group.handle}`));
}

function buildChatInfo(chat: DemoChat): CorpChatInfo {
  const peerId = chat.kind === KIND_DIRECT ? getPeerId(chat) : undefined;
  const peer = peerId ? employees.find((e) => e.id === peerId) : undefined;
  const lastReadId = state.lastReadId[chat.id] || 0;
  const unreadMentionsCount = messages.filter((m) => m.chatId === chat.id && !m.threadRootId && m.id > lastReadId
    && isMentioningMe(m)).length;
  const notify = state.notify[chat.id];
  const isAdmin = chat.adminIds.includes(ME);

  return {
    id: chat.id,
    title: peer ? peer.fullName : chat.title,
    kind: chat.kind,
    canPost: chat.kind !== KIND_CHANNEL || isAdmin,
    lastReadId,
    readMaxId: readMaxByOthers[chat.id] || 0,
    pinnedIds: [...(pinsByChat[chat.id] || [])],
    memberCount: chat.memberIds.length,
    isAdmin,
    peerId: peerId ?? undefined,
    unreadMentionsCount,
    notifyLevel: notify?.notifyLevel || 'all',
    mutedUntil: notify?.mutedUntil,
    call: undefined,
  };
}

function buildMember(employee: DemoEmployee, chat: DemoChat): CorpMember {
  return {
    id: employee.id,
    fullName: employee.fullName,
    login: employee.login,
    canPost: chat.kind !== KIND_CHANNEL || chat.adminIds.includes(employee.id),
    isAdmin: chat.adminIds.includes(employee.id),
    isOnline: employee.isOnline,
    lastSeenAt: employee.lastSeenAt,
    statusEmoji: employee.statusEmoji,
    statusText: employee.statusText,
    statusUntil: employee.statusUntil,
    dndUntil: employee.dndUntil,
  };
}

function buildEmployeeDto(employee: DemoEmployee) {
  const { isActive, isAdmin, ...dto } = employee;
  void isActive;
  void isAdmin;

  return dto;
}

function buildSavedDto(item: CorpSavedItem): CorpSavedItem {
  const message = messages.find((m) => m.id === item.messageId);

  return { ...item, message: message ? buildMessageDto(message) : undefined };
}

function buildActivity(): CorpActivityItem[] {
  const myIds = new Set(messages.filter((m) => m.senderId === ME).map((m) => m.id));
  const items: CorpActivityItem[] = [];
  messages.forEach((message) => {
    const chat = chats.find((c) => c.id === message.chatId)!;
    if (!isMember(chat)) return;
    if (isMentioningMe(message)) {
      items.push({
        type: 'mention', at: message.sentAt, chatId: message.chatId, messageId: message.id,
        actorId: message.senderId, actorName: message.senderName, message: buildMessageDto(message),
      });
    }
    if (message.threadRootId && message.senderId !== ME && (myIds.has(message.threadRootId)
      || messages.some((m) => m.threadRootId === message.threadRootId && m.senderId === ME))) {
      items.push({
        type: 'thread_reply', at: message.sentAt, chatId: message.chatId, messageId: message.id,
        actorId: message.senderId, actorName: message.senderName, message: buildMessageDto(message),
      });
    }
    if (myIds.has(message.id)) {
      Object.entries(message.reactionIds).forEach(([emoji, ids], index) => {
        ids.filter((id) => id !== ME).forEach((actorId, order) => {
          const actor = employees.find((e) => e.id === actorId)!;
          items.push({
            type: 'reaction',
            at: new Date(Date.parse(message.sentAt) + (index * 3 + order + 1) * 4 * MINUTE).toISOString(),
            chatId: message.chatId,
            messageId: message.id,
            actorId,
            actorName: actor.fullName,
            emoji,
            message: buildMessageDto(message),
          });
        });
      });
    }
  });

  return items.filter((item) => Date.parse(item.at) <= Date.now()).sort((a, b) => b.at.localeCompare(a.at));
}

// ---- routing ----

class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

interface RequestContext {
  body: any;
  params: string[];
  query: URLSearchParams;
}

type Handler = (context: RequestContext) => unknown;

const routes: [string, RegExp, Handler][] = [];

function route(method: string, path: string, handler: Handler) {
  routes.push([method, new RegExp(`^${path.replace(/:\w+/g, '([^/]+)')}$`), handler]);
}

function requireChat(id: string | number) {
  const chat = chats.find((c) => c.id === Number(id));
  if (!chat || !isMember(chat)) throw new HttpError(HTTP_NOT_FOUND, 'not_found');

  return chat;
}

function requireMessage(chat: DemoChat, id: string | number) {
  const message = messages.find((m) => m.chatId === chat.id && m.id === Number(id) && !m.isDeleted);
  if (!message) throw new HttpError(HTTP_NOT_FOUND, 'not_found');

  return message;
}

function selectPage(list: StoredMessage[], query: URLSearchParams) {
  const limit = Math.min(Number(query.get('limit')) || 50, MAX_LIMIT);
  const afterId = query.get('afterId') ?? undefined;
  const beforeId = query.get('beforeId') ?? undefined;
  const search = query.get('q')?.toLowerCase();
  let result = list.filter((m) => !m.isDeleted && (!search || m.text.toLowerCase().includes(search)));
  if (afterId !== undefined) {
    result = result.filter((m) => m.id > Number(afterId)).slice(0, limit);
  } else {
    if (beforeId !== undefined) result = result.filter((m) => m.id < Number(beforeId));
    result = result.slice(-limit);
  }

  return result.map(buildMessageDto);
}

route('POST', 'auth/login', ({ body }) => {
  const login = String(body?.login ?? '').trim().toLowerCase();
  if ((login !== 'demo' && login !== DEMO_EMPLOYEE.login) || body?.password !== 'demo') {
    throw new HttpError(HTTP_UNAUTHORIZED, 'unauthorized');
  }

  return {
    accessToken: DEMO_TOKEN,
    employee: { id: ME, login: DEMO_EMPLOYEE.login, fullName: DEMO_EMPLOYEE.fullName },
  };
});
route('POST', 'auth/register', ({ body }) => {
  if (employees.some((e) => e.login === String(body?.login).trim())) throw new HttpError(HTTP_CONFLICT, 'login_taken');
  return { status: 'pending' };
});
route('POST', 'auth/logout', () => undefined);
route('GET', 'me', () => ({ id: ME, login: DEMO_EMPLOYEE.login, fullName: DEMO_EMPLOYEE.fullName }));
route('PATCH', 'me', ({ body }) => {
  if (typeof body?.phone === 'string') DEMO_EMPLOYEE.phone = body.phone || undefined;
  return buildEmployeeDto(DEMO_EMPLOYEE);
});
route('PUT', 'me/status', ({ body }) => {
  DEMO_EMPLOYEE.statusEmoji = body?.emoji || undefined;
  DEMO_EMPLOYEE.statusText = body?.text || undefined;
  DEMO_EMPLOYEE.statusUntil = body?.until || undefined;
  DEMO_EMPLOYEE.dndUntil = body?.dndUntil || undefined;
  emit('status_changed', {
    employeeId: ME, emoji: body?.emoji, text: body?.text, until: body?.until, dndUntil: body?.dndUntil,
  });

  return {
    statusEmoji: DEMO_EMPLOYEE.statusEmoji,
    statusText: DEMO_EMPLOYEE.statusText,
    statusUntil: DEMO_EMPLOYEE.statusUntil,
    dndUntil: DEMO_EMPLOYEE.dndUntil,
  };
});
route('GET', 'config', () => ({
  jiraBaseUrl: JIRA_BASE_URL,
  jiraKeyPattern: '\\b[A-Z][A-Z0-9]+-\\d+\\b',
  callsEnabled: false,
}));
route('GET', 'groups', () => groups);
route('GET', 'apps', () => apps.map((app) => ({
  ...app, url: new URL(`demo-app.html?app=${app.url}`, location.href).href,
})));
route('POST', 'apps/:id/token', ({ params }) => ({
  token: `demo-sso-${params[0]}-${Math.random().toString(36).slice(2, 10)}`,
  expiresAt: ahead(MINUTE),
}));
route('GET', 'employees', () => employees.filter((e) => e.isActive).map(buildEmployeeDto));
route('POST', 'employees/:id/wakeup', ({ params }) => {
  const target = employees.find((e) => e.id === Number(params[0]) && e.isActive);
  if (!target || target.id === ME) throw new HttpError(HTTP_NOT_FOUND, 'not_found');
  if (target.dndUntil && Date.parse(target.dndUntil) > Date.now()) throw new HttpError(HTTP_CONFLICT, 'dnd');
  return undefined;
});
route('GET', 'jira/issues/:key', ({ params }) => {
  const key = decodeURIComponent(params[0]).toUpperCase();
  const issue = JIRA_ISSUES[key];
  if (!issue) throw new HttpError(HTTP_NOT_FOUND, 'not_found');
  return { key, url: `${JIRA_BASE_URL}${key}`, ...issue };
});

route('GET', 'chats', () => chats.filter((chat) => isMember(chat)).map(buildChatInfo));
route('GET', 'chats/directory', () => chats.filter((chat) => chat.isPublic && chat.kind !== KIND_DIRECT)
  .map((chat): CorpDirectoryChat => ({
    id: chat.id,
    title: chat.title,
    kind: chat.kind,
    description: chat.description,
    memberCount: chat.memberIds.length,
    isMember: isMember(chat),
  })));
route('POST', 'chats/direct', ({ body }) => {
  const peerId = Number(body?.employeeId);
  if (!employees.some((e) => e.id === peerId && e.isActive) || peerId === ME) {
    throw new HttpError(HTTP_NOT_FOUND, 'not_found');
  }
  let chat = chats.find((c) => c.kind === KIND_DIRECT && c.memberIds.includes(peerId) && c.memberIds.includes(ME));
  if (!chat) {
    chat = {
      id: chats.length + 1, title: '', kind: KIND_DIRECT, memberIds: [ME, peerId], adminIds: [], isPublic: false,
      description: '',
    };
    chats.push(chat);
    emit('chats_changed', {});
  }

  return buildChatInfo(chat);
});
route('POST', 'chats/:id/join', ({ params }) => {
  const chat = chats.find((c) => c.id === Number(params[0]) && c.isPublic);
  if (!chat) throw new HttpError(HTTP_NOT_FOUND, 'not_found');
  if (!isMember(chat)) chat.memberIds.push(ME);
  state.lastReadId[chat.id] = Math.max(0, ...messages.filter((m) => m.chatId === chat.id).map((m) => m.id));
  emit('chats_changed', {});

  return undefined;
});
route('GET', 'chats/:id/members', ({ params }) => {
  const chat = requireChat(params[0]);
  return chat.memberIds.map((id) => employees.find((e) => e.id === id)!)
    .filter((e) => e.isActive).map((e) => buildMember(e, chat));
});
route('GET', 'chats/:id/messages', ({ params, query }) => {
  const chat = requireChat(params[0]);
  return selectPage(messages.filter((m) => m.chatId === chat.id && (!m.threadRootId || m.alsoToChannel)), query);
});
route('GET', 'chats/:id/threads/:root/messages', ({ params, query }) => {
  const chat = requireChat(params[0]);
  return selectPage(messages.filter((m) => m.chatId === chat.id && m.threadRootId === Number(params[1])), query);
});
route('POST', 'chats/:id/threads/:root/read', ({ params, body }) => {
  const key = `${Number(params[0])}:${Number(params[1])}`;
  threadRead[key] = Math.max(threadRead[key] || 0, Number(body?.maxId) || 0);
});
route('GET', 'chats/:id/changes', () => ({ edited: [], deletedIds: [], serverTime: new Date().toISOString() }));
route('GET', 'chats/:id/mentions', ({ params }) => {
  const chat = requireChat(params[0]);
  const lastReadId = state.lastReadId[chat.id] || 0;
  return messages.filter((m) => m.chatId === chat.id && m.id > lastReadId && isMentioningMe(m)).map(buildMessageDto);
});
route('POST', 'chats/:id/mentions/read', () => undefined);
route('POST', 'chats/:id/read', ({ params, body }) => {
  const chat = requireChat(params[0]);
  state.lastReadId[chat.id] = Math.max(state.lastReadId[chat.id] || 0, Number(body?.maxId) || 0);
});
route('POST', 'chats/:id/typing', () => undefined);
route('PUT', 'chats/:id/notify', ({ params, body }) => {
  const chat = requireChat(params[0]);
  const current = state.notify[chat.id] || { notifyLevel: 'all' };
  const next = {
    notifyLevel: body?.level || current.notifyLevel,
    mutedUntil: body?.unmute ? undefined : (body?.mutedUntil ?? current.mutedUntil),
  };
  state.notify[chat.id] = next;

  return next;
});
route('POST', 'chats/:id/messages', ({ params, body }) => {
  const chat = requireChat(params[0]);
  return postMessage(chat, body);
});
route('POST', 'chats/:id/forward', ({ params, body }) => {
  const chat = requireChat(params[0]);
  const from = requireChat(body?.fromChatId);
  return (body?.messageIds as number[]).map((id) => {
    const original = requireMessage(from, id);
    const message = createMessage(chat.id, ME, original.text, new Date().toISOString(), {
      entities: original.entities,
      media: original.media,
      forward: {
        fromChatId: from.id, fromMessageId: original.id, senderName: original.senderName, sentAt: original.sentAt,
      },
    });
    messages.push(message);
    const dto = buildMessageDto(message);
    emit('message', dto);
    return dto;
  });
});
route('PATCH', 'chats/:id/messages/:mid', ({ params, body }) => {
  const chat = requireChat(params[0]);
  const message = requireMessage(chat, params[1]);
  message.text = String(body?.text ?? '');
  message.entities = body?.entities;
  message.editedAt = new Date().toISOString();
  const dto = buildMessageDto(message);
  emit('message_edited', dto);

  return dto;
});
route('DELETE', 'chats/:id/messages', ({ params, body }) => {
  const chat = requireChat(params[0]);
  const ids = (body?.ids as number[]) || [];
  ids.forEach((id) => {
    const message = messages.find((m) => m.chatId === chat.id && m.id === id);
    if (message) message.isDeleted = true;
  });
  emit('messages_deleted', { chatId: chat.id, ids });
});
route('PUT', 'chats/:id/messages/:mid/reactions', ({ params, body }) => {
  const chat = requireChat(params[0]);
  const message = requireMessage(chat, params[1]);
  Object.keys(message.reactionIds).forEach((emoji) => {
    message.reactionIds[emoji] = message.reactionIds[emoji].filter((id) => id !== ME);
  });
  const emoji = String(body?.emoji ?? '');
  if (emoji) (message.reactionIds[emoji] ||= []).push(ME);
  const reactions = buildReactions(message);
  emit('reactions', { chatId: chat.id, messageId: message.id, reactions });

  return reactions;
});
route('PUT', 'chats/:id/pins/:mid', ({ params }) => {
  const chat = requireChat(params[0]);
  const pins = (pinsByChat[chat.id] ||= []);
  if (!pins.includes(Number(params[1]))) pins.push(Number(params[1]));
  emit('pins', { chatId: chat.id, pinnedIds: [...pins] });
});
route('DELETE', 'chats/:id/pins/:mid', ({ params }) => {
  const chat = requireChat(params[0]);
  pinsByChat[chat.id] = (pinsByChat[chat.id] || []).filter((id) => id !== Number(params[1]));
  emit('pins', { chatId: chat.id, pinnedIds: [...pinsByChat[chat.id]] });
});
route('GET', 'chats/:id/scheduled', ({ params }) => {
  const chat = requireChat(params[0]);
  return scheduled.filter((s) => s.chatId === chat.id);
});
route('POST', 'chats/:id/scheduled', ({ params, body }) => {
  const chat = requireChat(params[0]);
  const item: CorpScheduledMessage = { ...body, id: nextId++, chatId: chat.id, createdAt: new Date().toISOString() };
  scheduled.push(item);
  emit('scheduled_changed', { chatId: chat.id });

  return item;
});
route('PATCH', 'chats/:id/scheduled/:sid', ({ params, body }) => {
  const item = scheduled.find((s) => s.id === Number(params[1]));
  if (!item) throw new HttpError(HTTP_NOT_FOUND, 'not_found');
  Object.assign(item, body);
  emit('scheduled_changed', { chatId: item.chatId });

  return item;
});
route('DELETE', 'chats/:id/scheduled/:sid', ({ params }) => {
  const index = scheduled.findIndex((s) => s.id === Number(params[1]));
  if (index >= 0) scheduled.splice(index, 1);
  emit('scheduled_changed', { chatId: Number(params[0]) });
});
route('POST', 'chats/:id/scheduled/:sid/send', ({ params }) => {
  const chat = requireChat(params[0]);
  const index = scheduled.findIndex((s) => s.id === Number(params[1]));
  if (index < 0) throw new HttpError(HTTP_NOT_FOUND, 'not_found');
  const [item] = scheduled.splice(index, 1);
  emit('scheduled_changed', { chatId: chat.id });

  return postMessage(chat, { text: item.text, entities: item.entities, replyToId: item.replyToId });
});
route('PUT', 'polls/:id/vote', ({ params, body }) => {
  const poll = polls.get(Number(params[0]));
  if (!poll) throw new HttpError(HTTP_NOT_FOUND, 'not_found');
  const optionIds = (body?.optionIds as number[]) || [];
  poll.options.forEach((option) => {
    option.voterIds = option.voterIds.filter((id) => id !== ME);
    if (optionIds.includes(option.id)) option.voterIds.push(ME);
  });
  emitPoll(poll);

  return buildPoll(poll);
});
route('POST', 'polls/:id/close', ({ params }) => {
  const poll = polls.get(Number(params[0]));
  if (!poll) throw new HttpError(HTTP_NOT_FOUND, 'not_found');
  poll.isClosed = true;
  emitPoll(poll);

  return buildPoll(poll);
});
route('GET', 'search', ({ query }) => {
  const search = query.get('q')?.toLowerCase() || '';
  const limit = Number(query.get('limit')) || 50;
  const myChatIds = new Set(chats.filter((chat) => isMember(chat)).map((chat) => chat.id));
  return messages.filter((m) => myChatIds.has(m.chatId) && !m.isDeleted && m.text.toLowerCase().includes(search))
    .reverse().slice(0, limit).map(buildMessageDto);
});
route('GET', 'me/saved', () => saved.filter((item) => !item.doneAt).map(buildSavedDto));
route('POST', 'me/saved', ({ body }) => {
  const existing = saved.find((item) => item.messageId === Number(body?.messageId) && !item.doneAt);
  if (existing) return buildSavedDto(existing);
  const message = messages.find((m) => m.id === Number(body?.messageId));
  if (!message) throw new HttpError(HTTP_NOT_FOUND, 'not_found');
  const item: CorpSavedItem = {
    id: saved.length + 1,
    messageId: message.id,
    chatId: message.chatId,
    remindAt: body?.remindAt,
    createdAt: new Date().toISOString(),
  };
  saved.push(item);

  return buildSavedDto(item);
});
route('PATCH', 'me/saved/:id', ({ params, body }) => {
  const item = saved.find((s) => s.id === Number(params[0]));
  if (!item) throw new HttpError(HTTP_NOT_FOUND, 'not_found');
  if (body?.remindAt) {
    item.remindAt = body.remindAt;
    item.remindedAt = undefined;
  }
  if (body?.clearRemind) item.remindAt = undefined;
  if (body?.done) item.doneAt = new Date().toISOString();

  return buildSavedDto(item);
});
route('DELETE', 'me/saved/:id', ({ params }) => {
  const index = saved.findIndex((s) => s.id === Number(params[0]));
  if (index >= 0) saved.splice(index, 1);
});
route('GET', 'me/activity', ({ query }) => {
  const limit = Number(query.get('limit')) || 30;
  const before = query.get('before');
  return buildActivity().filter((item) => !before || item.at < before).slice(0, limit);
});
route('GET', 'files/:id', () => undefined);

function emitPoll(poll: StoredPoll) {
  const message = messages.find((m) => m.poll?.id === poll.id);
  if (message) emit('poll_updated', { chatId: message.chatId, messageId: message.id, poll: buildPoll(poll, 0) });
}

function postMessage(chat: DemoChat, body: any) {
  let poll: StoredPoll | undefined;
  if (body?.poll) {
    poll = {
      id: nextPollId++,
      question: body.poll.question,
      isAnonymous: Boolean(body.poll.isAnonymous),
      isMultiple: Boolean(body.poll.isMultiple),
      isClosed: false,
      closesAt: body.poll.closesAt,
      options: (body.poll.options as string[]).map((text, index) => ({ id: index + 1, text, voterIds: [] })),
    };
    polls.set(poll.id, poll);
  }
  const uploaded = body?.fileId ? files.get(body.fileId) : undefined;
  const message = createMessage(chat.id, ME, String(body?.text ?? ''), new Date().toISOString(), {
    entities: body?.entities,
    replyToId: body?.replyToId,
    clientId: body?.clientId,
    threadRootId: body?.threadRootId,
    alsoToChannel: body?.alsoToChannel,
    media: body?.fileId ? buildUploadedMedia(body.fileId, uploaded) : undefined,
  });
  if (poll) message.poll = buildPoll(poll);
  messages.push(message);
  state.lastReadId[chat.id] = message.id;
  const dto = buildMessageDto(message);
  setTimeout(() => {
    emit('message', dto);
    if (message.threadRootId) emitThread(chat.id, message.threadRootId);
  }, 0);
  scheduleColleagueReply(chat, message);

  return dto;
}

function emitThread(chatId: number, rootId: number) {
  const root = messages.find((m) => m.id === rootId);
  const thread = root ? buildMessageDto(root).thread : undefined;
  if (thread) {
    emit('thread_updated', {
      chatId, rootId, replyCount: thread.replyCount, lastReplyAt: thread.lastReplyAt,
      recentReplierIds: thread.recentReplierIds,
    });
  }
}

function buildUploadedMedia(fileId: string, upload: DemoFile | Blob | undefined) {
  const blob = upload instanceof Blob ? upload : undefined;
  const mime = blob?.type || 'application/octet-stream';
  const meta = uploadMeta.get(fileId);
  type MediaKind = NonNullable<CorpMessage['media']>['kind'];
  const kind = (meta?.kind || (mime.startsWith('image/') ? 'photo' : 'document')) as MediaKind;

  return {
    fileId,
    kind,
    mime,
    size: blob?.size,
    fileName: meta?.fileName,
    width: meta?.width,
    height: meta?.height,
    duration: meta?.duration,
    waveform: meta?.waveform,
  };
}

// A colleague answers a few seconds after the demo employee writes in a DM or a small group
const REPLIES = [
  'Tushundim, rahmat! 👍',
  'Xo\'p, hozir qarayman.',
  'Ajoyib, kelishdik ✅',
  'Bir daqiqa, aniqlab aytaman.',
  'Rahmat, qabul qildim 🙏',
];
let replyIndex = 0;

function scheduleColleagueReply(chat: DemoChat, message: StoredMessage) {
  if (message.threadRootId || chat.kind === KIND_CHANNEL) return;
  const responderId = chat.kind === KIND_DIRECT
    ? getPeerId(chat)
    : chat.memberIds.find((id) => id !== ME && employees.find((e) => e.id === id)?.isOnline);
  if (!responderId) return;
  const responder = employees.find((e) => e.id === responderId)!;
  setTimeout(() => {
    readMaxByOthers[chat.id] = message.id;
    emit('read', { chatId: chat.id, employeeId: responderId, maxId: message.id });
    emit('typing', {
      chatId: chat.id, employeeId: responderId, fullName: responder.fullName, action: 'typing',
    });
  }, TYPING_DELAY);
  setTimeout(() => {
    postAs(chat.id, responderId, REPLIES[replyIndex++ % REPLIES.length], message.id);
  }, REPLY_DELAY);
}

export function postAs(chatId: number, senderId: number, text: string, replyToId?: number) {
  const message = createMessage(chatId, senderId, text, new Date().toISOString(), { replyToId });
  messages.push(message);
  readMaxByOthers[chatId] = message.id;
  const dto = buildMessageDto(message);
  emit('message', dto);
  if (isMentioningMe(message)) {
    emit('mention', {
      chatId, messageId: message.id, fromId: senderId, fromName: message.senderName, text, reason: 'mention',
    });
  }
}

export function startDemoLife() {
  const tick = () => {
    const [chatId, senderId, text] = LIVE_LINES[liveIndex++ % LIVE_LINES.length];
    const sender = employees.find((e) => e.id === senderId)!;
    emit('typing', {
      chatId, employeeId: senderId, fullName: sender.fullName, action: 'typing',
    });
    setTimeout(() => postAs(chatId, senderId, text), REPLY_DELAY);
  };
  const first = setTimeout(tick, LIVE_FIRST_DELAY);
  const every = setInterval(tick, LIVE_EVERY_DELAY);

  return () => {
    clearTimeout(first);
    clearInterval(every);
  };
}

// ---- transport ----

const uploadMeta = new Map<string, Record<string, any>>();

function respond(status: number, data?: unknown) {
  if (status === HTTP_NO_CONTENT || data === undefined) return new Response(undefined, { status: HTTP_NO_CONTENT });
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}

async function handleFileDownload(fileId: string) {
  const stored = files.get(fileId);
  if (!stored) return new Response(undefined, { status: HTTP_NOT_FOUND });
  const blob = stored instanceof Blob ? stored : await buildDemoFile(stored);
  if (!(stored instanceof Blob)) files.set(fileId, blob);

  return new Response(blob, {
    status: HTTP_OK,
    headers: { 'Content-Type': blob.type || 'application/octet-stream', 'Content-Length': String(blob.size) },
  });
}

async function handleRequest(method: string, path: string, rawBody: unknown) {
  await new Promise((resolve) => {
    setTimeout(resolve, MIN_LATENCY + Math.random() * LATENCY_SPREAD);
  });
  const [pathname, search = ''] = path.split('?');
  if (method === 'GET' && pathname.startsWith('files/')) {
    return handleFileDownload(decodeURIComponent(pathname.slice('files/'.length)));
  }
  const match = routes.find(([routeMethod, re]) => routeMethod === method && re.test(pathname));
  if (!match) return respond(HTTP_NOT_FOUND, { error: 'not_found' });
  try {
    const params = pathname.match(match[1])!.slice(1);
    const body = typeof rawBody === 'string' && rawBody ? JSON.parse(rawBody) : undefined;
    const result = await match[2]({ body, params, query: new URLSearchParams(search) });

    return respond(result === undefined ? HTTP_NO_CONTENT : HTTP_OK, result);
  } catch (err) {
    if (err instanceof HttpError) return respond(err.status, { error: err.message });
    return respond(HTTP_BAD_REQUEST, { error: 'bad_request' });
  }
}

export function installDemoCorpServer() {
  const originalFetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);
    if (!url.startsWith(API_PREFIX)) return originalFetch(input, init);

    return handleRequest((init?.method || 'GET').toUpperCase(), url.slice(API_PREFIX.length), init?.body);
  };

  // `uploadCorpFile` posts multipart form data with XHR for upload progress
  const { open, send, setRequestHeader } = XMLHttpRequest.prototype;
  const demoUrls = new WeakMap<XMLHttpRequest, string>();
  XMLHttpRequest.prototype.open = function openDemo(this: XMLHttpRequest, ...args: any[]) {
    const url = String(args[1]);
    if (url.startsWith(API_PREFIX)) demoUrls.set(this, url);
    return (open as (...openArgs: any[]) => void).apply(this, args);
  };
  XMLHttpRequest.prototype.setRequestHeader = function setDemoHeader(
    this: XMLHttpRequest, name: string, value: string,
  ) {
    if (demoUrls.has(this)) return;
    setRequestHeader.call(this, name, value);
  };
  XMLHttpRequest.prototype.send = function sendDemo(
    this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null,
  ) {
    if (!demoUrls.has(this)) {
      send.call(this, body as XMLHttpRequestBodyInit | null | undefined);
      return;
    }
    const form = body as FormData;
    const file = form.get('file') as File;
    const fileId = `upload-${nextId++}`;
    files.set(fileId, file);
    const meta: Record<string, any> = { kind: form.get('kind'), fileName: file.name };
    ['width', 'height', 'duration', 'waveform'].forEach((key) => {
      const value = form.get(key) ?? undefined;
      if (typeof value === 'string') meta[key] = key === 'waveform' ? value : Number(value);
    });
    uploadMeta.set(fileId, meta);
    const result = JSON.stringify({ fileId, size: file.size, mime: file.type || 'application/octet-stream' });
    const steps = [0.35, 0.7, 1];
    steps.forEach((step, index) => {
      setTimeout(() => {
        this.upload.dispatchEvent(new ProgressEvent('progress', {
          lengthComputable: true, loaded: step * file.size, total: file.size,
        }));
        if (step === 1) {
          Object.defineProperty(this, 'status', { value: HTTP_OK });
          Object.defineProperty(this, 'responseText', { value: result });
          this.dispatchEvent(new ProgressEvent('load'));
        }
      }, (index + 1) * 180);
    });
  };
}

// Runs last: seeding uses every constant above
seed();
