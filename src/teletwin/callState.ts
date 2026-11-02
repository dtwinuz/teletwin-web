// Corp call state: one call per tab at a time, driven by the hub (`call_ring`, `call_ring_ended`, `call_updated`),
// `GET /api/chats` (`chat.call`, restores a ringing call after a reconnect) and the user's own actions.
// Pure reducer: side effects (REST, LiveKit) live in `calls.ts`.
import type {
  CorpCall, CorpCallParticipant, CorpCallRing, CorpCallRingEnded, CorpCallState, CorpChatInfo, CorpJoinCall,
} from './api';

import { CORP_CHAT_KIND_DIRECT } from './api';

// incoming: a direct call rings here; outgoing: my direct call rings the other side;
// joining: waiting for the join token or the media connection; active: in the call
export type CorpCallPhase = 'incoming' | 'outgoing' | 'joining' | 'active';

export type CorpCallNotice = 'TeleTwinCallCalleeOffline' | 'TeleTwinCallCalleeBusy' | 'TeleTwinCallFull'
  | 'TeleTwinCallUnavailable' | 'TeleTwinCallDeclined' | 'TeleTwinCallNoAnswer' | 'TeleTwinCallEnded'
  | 'TeleTwinCallRemoved' | 'TeleTwinCallFailed' | 'TeleTwinCallNoMicrophone';

export interface CorpCallSession {
  phase: CorpCallPhase;
  // Server chat id
  chatId: number;
  callId?: number;
  isDirect: boolean;
  // The other employee of a direct call or the chat title
  title: string;
  withVideo: boolean;
  isCaller: boolean;
  canPublish: boolean;
  canEndForAll: boolean;
  ringExpiresAt?: string;
  // Server snapshot (LiveKit webhooks)
  participants: CorpCallParticipant[];
}

export interface CorpChatCallSummary {
  callId: number;
  state: CorpCallState;
  participantCount: number;
}

export interface CorpCallsState {
  session?: CorpCallSession;
  // Ongoing calls by server chat id: the header button offers to join them
  activeByChat: Record<number, CorpChatCallSummary>;
  notice?: CorpCallNotice;
}

export type CorpCallEvent =
  | { type: 'chats'; chats: CorpChatInfo[]; myId: number; now: number }
  | { type: 'ring'; ring: CorpCallRing }
  | { type: 'ringEnded'; ended: CorpCallRingEnded }
  | { type: 'updated'; call: CorpCall }
  | {
    type: 'start'; chatId: number; isDirect: boolean; title: string; withVideo: boolean; canEndForAll: boolean;
  }
  | { type: 'accept' }
  | { type: 'joined'; join: CorpJoinCall }
  | { type: 'failed'; notice?: CorpCallNotice }
  | { type: 'hangUp' }
  | { type: 'clearNotice' }
  | { type: 'reset' };

export const INITIAL_CORP_CALLS_STATE: CorpCallsState = { activeByChat: {} };

const HTTP_CONFLICT = 409;
const HTTP_SERVICE_UNAVAILABLE = 503;

const CONFLICT_NOTICES: Record<string, CorpCallNotice> = {
  callee_offline: 'TeleTwinCallCalleeOffline',
  callee_busy: 'TeleTwinCallCalleeBusy',
  call_full: 'TeleTwinCallFull',
};

export function reduceCorpCalls(state: CorpCallsState, event: CorpCallEvent): CorpCallsState {
  switch (event.type) {
    case 'chats':
      return applyChats(state, event.chats, event.myId, event.now);
    case 'ring':
      return applyRing(state, event.ring);
    case 'ringEnded':
      return applyRingEnded(state, event.ended);
    case 'updated':
      return applyUpdated(state, event.call);
    case 'start':
      if (state.session) return state;
      return {
        ...state,
        notice: undefined,
        session: {
          phase: event.isDirect ? 'outgoing' : 'joining',
          chatId: event.chatId,
          isDirect: event.isDirect,
          title: event.title,
          withVideo: event.withVideo,
          isCaller: true,
          canPublish: true,
          canEndForAll: event.canEndForAll,
          participants: [],
        },
      };
    case 'accept':
      if (state.session?.phase !== 'incoming') return state;
      return { ...state, session: { ...state.session, phase: 'joining' } };
    case 'joined':
      return applyJoined(state, event.join);
    case 'failed':
      return { ...state, session: undefined, notice: event.notice };
    case 'hangUp':
      return state.session ? { ...state, session: undefined } : state;
    case 'clearNotice':
      return state.notice ? { ...state, notice: undefined } : state;
    case 'reset':
      return INITIAL_CORP_CALLS_STATE;
    default:
      return state;
  }
}

// A failed `POST /call`: the notice for the 409/503 answers, `undefined` when the failure has no message of its own
export function getJoinFailureNotice(status?: number, code?: string): CorpCallNotice | undefined {
  if (status === HTTP_CONFLICT) return (code && CONFLICT_NOTICES[code]) || 'TeleTwinCallFailed';
  if (status === HTTP_SERVICE_UNAVAILABLE) return 'TeleTwinCallUnavailable';
  return 'TeleTwinCallFailed';
}

function applyChats(state: CorpCallsState, chats: CorpChatInfo[], myId: number, now: number): CorpCallsState {
  const activeByChat: Record<number, CorpChatCallSummary> = {};
  chats.forEach(({ id, call }) => {
    if (call && call.state !== 'ended') {
      activeByChat[id] = { callId: call.callId, state: call.state, participantCount: call.participantCount };
    }
  });

  let { session } = state;
  if (session?.phase === 'incoming' && activeByChat[session.chatId]?.callId !== session.callId) {
    // The ring ended while the hub was away
    session = undefined;
  }

  if (!session) {
    // A direct call that rang while the hub was away and still rings
    const ringing = chats.find(({ kind, call }) => kind === CORP_CHAT_KIND_DIRECT && call?.state === 'ringing'
      && call.startedById !== myId && call.ringExpiresAt && Date.parse(call.ringExpiresAt) > now);
    if (ringing) {
      const call = ringing.call!;
      session = {
        phase: 'incoming',
        chatId: ringing.id,
        callId: call.callId,
        isDirect: true,
        title: ringing.title,
        withVideo: Boolean(call.withVideo),
        isCaller: false,
        canPublish: true,
        canEndForAll: false,
        ringExpiresAt: call.ringExpiresAt || undefined,
        participants: [],
      };
    }
  }

  return { ...state, activeByChat, session };
}

function applyRing(state: CorpCallsState, ring: CorpCallRing): CorpCallsState {
  const activeByChat = {
    ...state.activeByChat,
    [ring.chatId]: { callId: ring.callId, state: 'ringing' as const, participantCount: 1 },
  };
  // A second call does not ring while I am in one (the server answers `callee_busy` anyway)
  if (state.session) return { ...state, activeByChat };

  return {
    ...state,
    activeByChat,
    notice: undefined,
    session: {
      phase: 'incoming',
      chatId: ring.chatId,
      callId: ring.callId,
      isDirect: true,
      title: ring.fromName,
      withVideo: Boolean(ring.withVideo),
      isCaller: false,
      canPublish: true,
      canEndForAll: false,
      ringExpiresAt: ring.expiresAt,
      participants: [],
    },
  };
}

function applyRingEnded(state: CorpCallsState, { callId, chatId, reason }: CorpCallRingEnded): CorpCallsState {
  const { session } = state;
  if (!session || session.chatId !== chatId || (session.callId !== undefined && session.callId !== callId)) {
    return state;
  }

  if (session.phase === 'incoming') {
    // Answered, declined or missed on another device, canceled by the caller or timed out
    return { ...state, session: undefined };
  }

  if (session.phase !== 'outgoing') return state;

  switch (reason) {
    case 'answered':
      return { ...state, session: { ...session, callId, phase: 'active' } };
    case 'declined':
      return { ...state, session: undefined, notice: 'TeleTwinCallDeclined' };
    case 'timeout':
      return { ...state, session: undefined, notice: 'TeleTwinCallNoAnswer' };
    case 'revoked':
      return { ...state, session: undefined, notice: 'TeleTwinCallEnded' };
    case 'cancelled':
      return { ...state, session: undefined };
    default:
      return state;
  }
}

function applyUpdated(state: CorpCallsState, call: CorpCall): CorpCallsState {
  const activeByChat = { ...state.activeByChat };
  if (call.active) {
    activeByChat[call.chatId] = { callId: call.callId, state: call.state, participantCount: call.participants.length };
  } else if (activeByChat[call.chatId]?.callId === call.callId) {
    delete activeByChat[call.chatId];
  }

  const { session } = state;
  if (!session || session.chatId !== call.chatId) return { ...state, activeByChat };
  // A snapshot of an older call of the same chat
  if (session.callId !== undefined && session.callId !== call.callId) return { ...state, activeByChat };

  if (!call.active) {
    return { ...state, activeByChat, session: undefined, notice: getEndNotice(session, call.endReason) };
  }

  if (session.phase === 'incoming') return { ...state, activeByChat };

  const phase = session.phase === 'outgoing' && call.state === 'active' ? 'active' : session.phase;

  return {
    ...state,
    activeByChat,
    session: {
      ...session, phase, callId: call.callId, participants: call.participants,
    },
  };
}

function applyJoined(state: CorpCallsState, join: CorpJoinCall): CorpCallsState {
  const { session } = state;
  if (!session || session.chatId !== join.chatId || session.phase === 'incoming') return state;

  const { call } = join;
  const phase = call.state === 'ringing' ? 'outgoing' : 'active';

  return {
    ...state,
    activeByChat: {
      ...state.activeByChat,
      [join.chatId]: { callId: call.callId, state: call.state, participantCount: call.participants.length },
    },
    session: {
      ...session,
      phase: session.phase === 'active' ? 'active' : phase,
      callId: join.callId,
      canPublish: join.canPublish,
      withVideo: session.withVideo && join.canPublish,
      ringExpiresAt: call.ringExpiresAt || undefined,
      participants: call.participants,
    },
  };
}

function getEndNotice(session: CorpCallSession, endReason?: string | null): CorpCallNotice | undefined {
  if (session.phase === 'incoming') return undefined;
  if (session.phase === 'outgoing') {
    if (endReason === 'declined') return 'TeleTwinCallDeclined';
    if (endReason === 'timeout') return 'TeleTwinCallNoAnswer';
    if (endReason === 'cancelled') return undefined;
  }

  return 'TeleTwinCallEnded';
}
