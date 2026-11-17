// Demo-only stand-in for the GramJS worker (`src/api/gramjs/worker/connector.ts` routes here when `TELETWIN_DEMO`).
// It "signs in" a fictional Telegram account at once and answers the Telegram API calls the UI makes with a few
// personal chats, so the corp layer runs next to a living Telegram side without any Telegram server.
import { getActions } from '../global';

import type {
  ApiAvailableReaction, ApiChat, ApiLanguage, ApiMessage, ApiUser, ApiUserStatus, OnApiUpdate,
} from '../api/types';

import { DEFAULT_APP_CONFIG } from '../limits';
import { DEMO_TELEGRAM_USER } from './session';

type Method = (params: any) => unknown;

interface PersonalMessageSeed {
  from: string;
  text: string;
  minutesAgo: number;
}

const MS_IN_SECOND = 1000;
const SECONDS_IN_MINUTE = 60;
const MINUTES_IN_HOUR = 60;
const MINUTES_IN_DAY = 24 * MINUTES_IN_HOUR;
const SEND_DELAY = 350;
const REPLY_DELAY = 3200;
const ME = DEMO_TELEGRAM_USER.id;

const MOTHER = '7200100101';
const BROTHER = '7200100102';
const SISTER = '7200100103';
const FRIEND = '7200100104';
const CLASSMATE = '7200100105';
const FAMILY_CHAT = '-4700200201';
const FOOTBALL_CHAT = '-1001700200202';
const WEATHER_CHANNEL = '-1001700200203';

const USERS: [string, string, string | undefined, boolean][] = [
  [MOTHER, 'Onam', undefined, true],
  [BROTHER, 'Bobur', 'aka', false],
  [SISTER, 'Malika', undefined, true],
  [FRIEND, 'Dilshod', 'Yo\'ldoshev', false],
  [CLASSMATE, 'Sardor', 'Rustamov', false],
];

const PERSONAL_CHATS: { chat: ApiChat; unread: number; pinned?: boolean; messages: PersonalMessageSeed[] }[] = [
  {
    chat: { id: MOTHER, type: 'chatTypePrivate', title: 'Onam', isMin: false },
    unread: 2,
    pinned: true,
    messages: [
      { from: ME, text: 'Assalomu alaykum, oyijon! Ishdaman, kechroq qo\'ng\'iroq qilaman.', minutesAgo: 6 * 60 },
      { from: MOTHER, text: 'Vaalaykum assalom, bolam. Mayli, ishingdan qolma.', minutesAgo: 5 * 60 + 50 },
      { from: MOTHER, text: 'Kechqurun kelasanmi? Osh qilyapman 🍲', minutesAgo: 25 },
      { from: MOTHER, text: 'Non olib kelishni unutma 🙂', minutesAgo: 24 },
    ],
  },
  {
    chat: {
      id: FAMILY_CHAT, type: 'chatTypeBasicGroup', title: 'Oila 👨‍👩‍👧‍👦', isMin: false, membersCount: 5,
    },
    unread: 3,
    messages: [
      { from: BROTHER, text: 'Shanba kuni dachaga boramizmi?', minutesAgo: 2 * MINUTES_IN_DAY },
      { from: SISTER, text: 'Men boraman! Somsa pishiraman 😋', minutesAgo: 2 * MINUTES_IN_DAY - 30 },
      { from: ME, text: 'Men ham boraman, 10:00 da yo\'lga chiqamiz.', minutesAgo: 2 * MINUTES_IN_DAY - 45 },
      {
        from: MOTHER, text: 'Dadangizning tug\'ilgan kuni yaqinlashyapti, sovg\'a haqida o\'ylab ko\'ringlar.',
        minutesAgo: 90,
      },
      { from: SISTER, text: 'Yangi soat olsak-chi? ⌚', minutesAgo: 80 },
      { from: BROTHER, text: 'Yaxshi fikr, men yarmini beraman.', minutesAgo: 70 },
    ],
  },
  {
    chat: {
      id: FOOTBALL_CHAT, type: 'chatTypeSuperGroup', title: 'Futbol 7×7 · Chilonzor', isMin: false, membersCount: 18,
    },
    unread: 0,
    messages: [
      { from: CLASSMATE, text: 'Payshanba 20:00, maydon band qilindi ⚽', minutesAgo: 3 * MINUTES_IN_DAY },
      { from: FRIEND, text: 'Men bor', minutesAgo: 3 * MINUTES_IN_DAY - 20 },
      { from: ME, text: 'Men ham, formani olib kelaman.', minutesAgo: 3 * MINUTES_IN_DAY - 30 },
      { from: CLASSMATE, text: 'Har kim 40 000 so\'mdan, maydon puli.', minutesAgo: 4 * 60 },
    ],
  },
  {
    chat: {
      id: WEATHER_CHANNEL, type: 'chatTypeChannel', title: 'Toshkent ob-havosi', isMin: false, membersCount: 48210,
    },
    unread: 1,
    messages: [
      {
        from: WEATHER_CHANNEL, text: 'Ertaga Toshkentda bulutli, +9…+14°C. Kechqurun yomg\'ir ehtimoli 60% ☔',
        minutesAgo: 20 * 60,
      },
      { from: WEATHER_CHANNEL, text: 'Bugun: quyoshli, +11…+17°C, shamol 3–5 m/s 🌤', minutesAgo: 3 * 60 },
    ],
  },
  {
    chat: { id: FRIEND, type: 'chatTypePrivate', title: 'Dilshod Yo\'ldoshev', isMin: false },
    unread: 0,
    messages: [
      { from: FRIEND, text: 'Jasur, hafta oxiri kinoga boramizmi?', minutesAgo: MINUTES_IN_DAY + 120 },
      { from: ME, text: 'Boramiz, yakshanba kechqurun bo\'sh vaqtim bor.', minutesAgo: MINUTES_IN_DAY + 100 },
      { from: FRIEND, text: 'Kelishdik 👍', minutesAgo: MINUTES_IN_DAY + 98 },
    ],
  },
  {
    chat: { id: ME, type: 'chatTypePrivate', title: 'Saqlangan xabarlar', isMin: false },
    unread: 0,
    messages: [
      {
        from: ME, text: 'Pasport yangilash: 5-dekabr, 10:00, Davlat xizmatlari markazi.',
        minutesAgo: 4 * MINUTES_IN_DAY,
      },
      {
        from: ME, text: 'Kitob ro\'yxati: "Atomic Habits", "O\'tkan kunlar", "Sapiens".',
        minutesAgo: 2 * MINUTES_IN_DAY,
      },
    ],
  },
];

const AUTO_REPLIES: Record<string, string> = {
  [MOTHER]: 'Xo\'p bolam, kutaman ❤️',
  [FRIEND]: 'Zo\'r, kelishdik!',
  [FAMILY_CHAT]: 'Rahmat! 😊',
  [FOOTBALL_CHAT]: 'Qabul qilindi 👍',
};

const LANGUAGES: ApiLanguage[] = [
  ['uz', 'Uzbek', 'O\'zbekcha'], ['ru', 'Russian', 'Russkiy'], ['en', 'English', 'English'],
].map(([langCode, name, nativeName]) => ({
  isOfficial: true,
  name,
  nativeName,
  langCode,
  pluralCode: langCode,
  stringsCount: 1,
  translatedCount: 1,
  translationsUrl: '',
}));

// Reactions offered on messages: Telegram serves their icons as documents, the demo draws them from the emoji font
const REACTION_EMOJIS = ['👍', '❤', '❤️', '🔥', '👏', '🎉', '🙏', '😂', '💪', '👌', '🏆', '😋', '🤝', '😮', '😢'];
const REACTION_ICON_PREFIX = 'documentdemoreaction';
const REACTION_ICON_SIZE = 96;

const AVAILABLE_REACTIONS: ApiAvailableReaction[] = REACTION_EMOJIS.map((emoticon, index) => ({
  reaction: { type: 'emoji', emoticon },
  title: emoticon,
  staticIcon: {
    mediaType: 'document', id: `demoreaction${index}`, fileName: 'reaction.png', size: 1, mimeType: 'image/png',
  },
}));

let onApiUpdate: OnApiUpdate | undefined;
const messagesByChat = new Map<string, ApiMessage[]>();
let nextMessageId = 500;

function buildUser(id: string, firstName: string, lastName?: string): ApiUser {
  return {
    id, isMin: false, type: 'userTypeRegular', firstName, lastName, phoneNumber: '', isContact: true,
  };
}

function buildUsers() {
  const me: ApiUser = {
    ...buildUser(ME, DEMO_TELEGRAM_USER.firstName, DEMO_TELEGRAM_USER.lastName),
    isSelf: true,
    isContact: undefined,
    phoneNumber: DEMO_TELEGRAM_USER.phone,
  };

  return [me, ...USERS.map(([id, firstName, lastName]) => buildUser(id, firstName, lastName))];
}

function buildStatuses() {
  const now = Math.floor(Date.now() / MS_IN_SECOND);
  const statuses: Record<string, ApiUserStatus> = {};
  USERS.forEach(([id, , , isOnline], index) => {
    statuses[id] = isOnline
      ? { type: 'userStatusOnline', expires: now + MINUTES_IN_HOUR * SECONDS_IN_MINUTE }
      : { type: 'userStatusOffline', wasOnline: now - (index + 1) * 47 * SECONDS_IN_MINUTE };
  });

  return statuses;
}

function seedMessages() {
  const now = Math.floor(Date.now() / MS_IN_SECOND);
  PERSONAL_CHATS.forEach(({ chat, messages }) => {
    messagesByChat.set(chat.id, messages.map(({ from, text, minutesAgo }) => ({
      id: nextMessageId++,
      chatId: chat.id,
      date: now - minutesAgo * SECONDS_IN_MINUTE,
      isOutgoing: from === ME && chat.id !== ME,
      senderId: from,
      content: { text: { text } },
    })));
  });
}

export function initDemoTelegram(onUpdate: OnApiUpdate) {
  onApiUpdate = onUpdate;
  seedMessages();
  const [currentUser] = buildUsers();
  onUpdate({ '@type': 'updateApiReady' });
  onUpdate({ '@type': 'updateConnectionState', connectionState: 'connectionStateReady' });
  onUpdate({ '@type': 'updateCurrentUser', currentUser, currentUserFullInfo: { bio: 'Toshkent · Orzu Logistika' } });
  onUpdate({ '@type': 'updateAuthorizationState', authorizationState: 'authorizationStateReady' });
  // Uzbek interface: TeleTwin strings are Uzbek, Telegram strings keep the English fallback, as in production
  setTimeout(() => {
    getActions().applyLanguage({ language: LANGUAGES[0] });
  }, 0);
}

function fetchChats({ archived, offsetDate }: { archived?: boolean; offsetDate?: number }) {
  if (archived || offsetDate) {
    return {
      chatIds: [], chats: [], users: [], userStatusesById: {}, draftsById: {}, totalChatCount: 0,
      lastMessageByChatId: {}, messages: [], notifyExceptionById: {}, isFullyLoaded: true, threadInfos: [],
      threadReadStatesById: {},
    };
  }
  const lastMessageByChatId: Record<string, number> = {};
  const threadReadStatesById: Record<string, { unreadCount: number; lastReadInboxMessageId: number }> = {};
  const messages: ApiMessage[] = [];
  PERSONAL_CHATS.forEach(({ chat, unread }) => {
    const list = messagesByChat.get(chat.id)!;
    const last = list[list.length - 1];
    lastMessageByChatId[chat.id] = last.id;
    messages.push(last);
    threadReadStatesById[chat.id] = {
      unreadCount: unread,
      lastReadInboxMessageId: list[Math.max(0, list.length - 1 - unread)].id,
    };
  });

  return {
    chatIds: PERSONAL_CHATS.map(({ chat }) => chat.id),
    chats: PERSONAL_CHATS.map(({ chat }) => ({ ...chat, isListed: true })),
    users: buildUsers(),
    userStatusesById: buildStatuses(),
    draftsById: {},
    orderedPinnedIds: PERSONAL_CHATS.filter(({ pinned }) => pinned).map(({ chat }) => chat.id),
    totalChatCount: PERSONAL_CHATS.length,
    lastMessageByChatId,
    messages,
    notifyExceptionById: {},
    isFullyLoaded: true,
    threadReadStatesById,
    threadInfos: PERSONAL_CHATS.map(({ chat }) => ({
      isCommentsInfo: false, chatId: chat.id, threadId: -1, lastMessageId: lastMessageByChatId[chat.id],
    })),
  };
}

// Telegram paging: `offsetId` marks a position, a negative `addOffset` also returns that many newer messages
function fetchMessages({
  chat, offsetId, addOffset = 0, limit,
}: { chat: ApiChat; offsetId?: number; addOffset?: number; limit: number }) {
  const list = messagesByChat.get(chat.id) || [];
  const position = offsetId ? list.findIndex((message) => message.id >= offsetId) : -1;
  const end = Math.min(list.length, (position === -1 ? list.length : position) - addOffset);

  return {
    messages: list.slice(Math.max(0, end - limit), Math.max(0, end)),
    users: buildUsers(),
    chats: [],
    count: list.length,
    topics: [],
  };
}

function sendMessage({ chat, text }: { chat: ApiChat; text?: string }) {
  if (!text || !onApiUpdate) return undefined;
  const update = onApiUpdate;
  const localId = nextMessageId++ + 0.5;
  const message: ApiMessage = {
    id: localId,
    chatId: chat.id,
    date: Math.floor(Date.now() / MS_IN_SECOND),
    isOutgoing: true,
    senderId: ME,
    content: { text: { text } },
    sendingState: 'messageSendingStatePending',
  };
  update({ '@type': 'newMessage', chatId: chat.id, id: localId, message });
  setTimeout(() => {
    const sent = { ...message, id: Math.floor(localId), sendingState: undefined };
    messagesByChat.get(chat.id)?.push(sent);
    update({
      '@type': 'updateMessageSendSucceeded', chatId: chat.id, localId, message: sent,
    });
  }, SEND_DELAY);

  const replyText = AUTO_REPLIES[chat.id];
  const replierId = chat.id === FAMILY_CHAT ? SISTER : (chat.id === FOOTBALL_CHAT ? CLASSMATE : chat.id);
  if (replyText) {
    setTimeout(() => {
      const reply: ApiMessage = {
        id: nextMessageId++,
        chatId: chat.id,
        date: Math.floor(Date.now() / MS_IN_SECOND),
        isOutgoing: false,
        senderId: replierId,
        content: { text: { text: replyText } },
      };
      messagesByChat.get(chat.id)?.push(reply);
      update({
        '@type': 'newMessage', chatId: chat.id, id: reply.id, message: reply,
      });
    }, REPLY_DELAY);
  }

  return message;
}

function drawReactionIcon(emoticon: string) {
  const canvas = document.createElement('canvas');
  canvas.width = REACTION_ICON_SIZE;
  canvas.height = REACTION_ICON_SIZE;
  const ctx = canvas.getContext('2d')!;
  ctx.font = `${REACTION_ICON_SIZE * 0.8}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(emoticon, REACTION_ICON_SIZE / 2, REACTION_ICON_SIZE * 0.54);

  return new Promise<Blob>((resolve) => {
    canvas.toBlob((blob) => resolve(blob!), 'image/png');
  });
}

async function downloadMedia({ url }: { url: string }) {
  if (!url.startsWith(REACTION_ICON_PREFIX)) return undefined;
  const emoticon = REACTION_EMOJIS[Number(url.slice(REACTION_ICON_PREFIX.length))];
  if (!emoticon) return undefined;

  return { dataBlob: await drawReactionIcon(emoticon), mimeType: 'image/png' };
}

const EMPTY_SEARCH = {
  messages: [], users: [], chats: [], topics: [], userStatusesById: {}, totalCount: 0,
};

const METHODS: Record<string, Method> = {
  fetchChats,
  downloadMedia,
  fetchAppConfig: () => ({ ...DEFAULT_APP_CONFIG, hash: 1 }),
  fetchAvailableReactions: () => AVAILABLE_REACTIONS,
  fetchTopReactions: () => ({
    reactions: AVAILABLE_REACTIONS.slice(0, 8).map(({ reaction }) => reaction), hash: '1',
  }),
  fetchRecentReactions: () => ({
    reactions: AVAILABLE_REACTIONS.slice(3, 6).map(({ reaction }) => reaction), hash: '1',
  }),
  fetchMessages,
  sendMessage,
  fetchLanguages: () => LANGUAGES,
  fetchLanguage: ({ langCode }: { langCode: string }) => LANGUAGES.find((language) => language.langCode === langCode),
  fetchLangPack: ({ langCode }: { langCode: string }) => ({ langCode, version: 1, strings: {} }),
  fetchLangDifference: () => undefined,
  fetchMessage: ({ chat, messageId }: { chat: ApiChat; messageId: number }) => {
    const message = messagesByChat.get(chat.id)?.find(({ id }) => id === messageId);
    return message ? { message } : undefined;
  },
  fetchMessagesById: ({ chat, messageIds }: { chat: ApiChat; messageIds: number[] }) => (
    messagesByChat.get(chat.id)?.filter(({ id }) => messageIds.includes(id)) || []
  ),
  fetchFullUser: ({ id }: { id: string }) => {
    const user = buildUsers().find((u) => u.id === id);
    return user ? {
      user, fullInfo: { bio: id === MOTHER ? 'Oila — eng katta boylik' : undefined }, users: [user], chats: [],
    } : undefined;
  },
  fetchFullChat: ({ id }: { id: string }) => ({
    fullInfo: {
      about: id === WEATHER_CHANNEL ? 'Toshkent ob-havosi har kuni ertalab va kechqurun' : undefined,
      members: [],
    },
    users: buildUsers(),
    chats: [],
  }),
  searchMessagesGlobal: () => EMPTY_SEARCH,
  searchMessagesInChat: () => EMPTY_SEARCH,
  searchChats: () => ({
    accountResultIds: [], globalResultIds: [], users: [], chats: [],
  }),
  fetchContactList: () => ({ users: buildUsers().slice(1), chats: [], userStatusesById: buildStatuses() }),
  markMessageListRead: () => true,
  fetchPinnedMessages: () => ({ messages: [] }),
  updateIsOnline: () => true,
};

export function callDemoTelegram(fnName: string, args: unknown[]) {
  const method = METHODS[fnName];

  return Promise.resolve(method ? method(args[0]) : undefined);
}
