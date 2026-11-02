import { describe, expect, it } from 'vitest';

import type { CorpCall, CorpChatInfo, CorpJoinCall } from './api';
import type { CorpCallEvent, CorpCallsState } from './callState';

import { CORP_CHAT_KIND_DIRECT, CORP_CHAT_KIND_GROUP } from './api';
import { getJoinFailureNotice, INITIAL_CORP_CALLS_STATE, reduceCorpCalls } from './callState';

const ME = 3;
const PEER = 7;
const DM = 12;
const GROUP = 2;
const NOW = Date.parse('2026-11-02T10:00:00Z');
const LATER = '2026-11-02T10:00:45Z';
const EARLIER = '2026-11-02T09:59:00Z';

function run(...events: CorpCallEvent[]) {
  return events.reduce<CorpCallsState>(reduceCorpCalls, INITIAL_CORP_CALLS_STATE);
}

function buildCall(overrides: Partial<CorpCall> = {}): CorpCall {
  return {
    callId: 41,
    chatId: DM,
    active: true,
    state: 'active',
    startedAt: EARLIER,
    startedById: ME,
    participants: [],
    ...overrides,
  };
}

function buildJoin(call: CorpCall, canPublish = true): CorpJoinCall {
  return {
    callId: call.callId,
    chatId: call.chatId,
    room: `chat-${call.chatId}`,
    url: 'wss://example/livekit',
    token: 'jwt',
    expiresAt: LATER,
    canPublish,
    call,
  };
}

const startDirect: CorpCallEvent = {
  type: 'start', chatId: DM, isDirect: true, title: 'Peer', withVideo: false, canEndForAll: false,
};
const startGroup: CorpCallEvent = {
  type: 'start', chatId: GROUP, isDirect: false, title: 'Team', withVideo: false, canEndForAll: true,
};
const ring: CorpCallEvent = {
  type: 'ring',
  ring: {
    callId: 57, chatId: DM, fromId: PEER, fromName: 'Peer', withVideo: false, expiresAt: LATER,
  },
};

describe('corp call state: outgoing direct call', () => {
  const ringing = buildCall({ state: 'ringing', ringExpiresAt: LATER });

  it('rings the other side, then becomes active when answered', () => {
    let state = run(startDirect);
    expect(state.session?.phase).toBe('outgoing');

    state = reduceCorpCalls(state, { type: 'joined', join: buildJoin(ringing) });
    expect(state.session).toMatchObject({ phase: 'outgoing', callId: 41, ringExpiresAt: LATER });
    expect(state.activeByChat[DM]).toEqual({ callId: 41, state: 'ringing', participantCount: 0 });

    state = reduceCorpCalls(state, { type: 'ringEnded', ended: { callId: 41, chatId: DM, reason: 'answered' } });
    expect(state.session?.phase).toBe('active');
  });

  it.each([
    ['declined', 'TeleTwinCallDeclined'],
    ['timeout', 'TeleTwinCallNoAnswer'],
    ['revoked', 'TeleTwinCallEnded'],
    ['cancelled', undefined],
  ] as const)('ends with a notice when the ring ends as %s', (reason, notice) => {
    const state = run(startDirect, { type: 'joined', join: buildJoin(ringing) },
      { type: 'ringEnded', ended: { callId: 41, chatId: DM, reason } });
    expect(state.session).toBeUndefined();
    expect(state.notice).toBe(notice);
  });

  it('becomes active from a `call_updated` snapshot as well', () => {
    const state = run(startDirect, { type: 'joined', join: buildJoin(ringing) },
      { type: 'updated', call: buildCall({ participants: [{ employeeId: ME, fullName: 'Me' }] }) });
    expect(state.session?.phase).toBe('active');
    expect(state.session?.participants).toHaveLength(1);
  });

  it('ignores ring events of other calls', () => {
    const state = run(startDirect, { type: 'joined', join: buildJoin(ringing) },
      { type: 'ringEnded', ended: { callId: 99, chatId: DM, reason: 'declined' } });
    expect(state.session?.phase).toBe('outgoing');
  });

  it.each([
    [409, 'callee_offline', 'TeleTwinCallCalleeOffline'],
    [409, 'callee_busy', 'TeleTwinCallCalleeBusy'],
    [409, 'call_full', 'TeleTwinCallFull'],
    [409, 'something_new', 'TeleTwinCallFailed'],
    [503, 'calls_disabled', 'TeleTwinCallUnavailable'],
    [503, 'calls_unavailable', 'TeleTwinCallUnavailable'],
    [500, undefined, 'TeleTwinCallFailed'],
  ] as const)('maps a failed join %s %s to a notice', (status, code, notice) => {
    const state = run(startDirect, { type: 'failed', notice: getJoinFailureNotice(status, code) });
    expect(state.session).toBeUndefined();
    expect(state.notice).toBe(notice);
  });
});

describe('corp call state: incoming direct call', () => {
  it('rings and joins after accept', () => {
    let state = run(ring);
    expect(state.session).toMatchObject({
      phase: 'incoming', callId: 57, chatId: DM, title: 'Peer', isCaller: false,
    });

    state = reduceCorpCalls(state, { type: 'accept' });
    expect(state.session?.phase).toBe('joining');

    // The server tells every device of mine, this one included, that the call was answered
    state = reduceCorpCalls(state, {
      type: 'ringEnded', ended: { callId: 57, chatId: DM, reason: 'answered_elsewhere' },
    });
    expect(state.session?.phase).toBe('joining');

    state = reduceCorpCalls(state, { type: 'joined', join: buildJoin(buildCall({ callId: 57, startedById: PEER })) });
    expect(state.session?.phase).toBe('active');
  });

  it.each(['answered_elsewhere', 'cancelled', 'timeout', 'revoked'] as const)(
    'stops ringing without a notice when the ring ends as %s',
    (reason) => {
      const state = run(ring, { type: 'ringEnded', ended: { callId: 57, chatId: DM, reason } });
      expect(state.session).toBeUndefined();
      expect(state.notice).toBeUndefined();
    },
  );

  it('does not ring over an ongoing call', () => {
    const state = run(startGroup, ring);
    expect(state.session?.chatId).toBe(GROUP);
    expect(state.activeByChat[DM]?.state).toBe('ringing');
  });

  it('declining ends the session', () => {
    expect(run(ring, { type: 'hangUp' }).session).toBeUndefined();
  });
});

describe('corp call state: chat list catch-up', () => {
  function buildChat(id: number, kind: number, call?: CorpChatInfo['call']): CorpChatInfo {
    return {
      id, title: `Chat ${id}`, kind, canPost: true, peerId: kind === CORP_CHAT_KIND_DIRECT ? PEER : undefined, call,
    };
  }

  it('restores a ring that started while the hub was away', () => {
    const state = run({
      type: 'chats',
      myId: ME,
      now: NOW,
      chats: [buildChat(DM, CORP_CHAT_KIND_DIRECT, {
        callId: 57, state: 'ringing', participantCount: 1, startedAt: EARLIER, startedById: PEER, ringExpiresAt: LATER,
      })],
    });
    expect(state.session).toMatchObject({ phase: 'incoming', callId: 57, title: `Chat ${DM}` });
  });

  it('skips expired rings and my own rings', () => {
    const state = run({
      type: 'chats',
      myId: ME,
      now: NOW,
      chats: [
        buildChat(DM, CORP_CHAT_KIND_DIRECT, {
          callId: 57, state: 'ringing', participantCount: 1, startedAt: EARLIER, startedById: PEER,
          ringExpiresAt: EARLIER,
        }),
        buildChat(DM + 1, CORP_CHAT_KIND_DIRECT, {
          callId: 58, state: 'ringing', participantCount: 1, startedAt: EARLIER, startedById: ME, ringExpiresAt: LATER,
        }),
      ],
    });
    expect(state.session).toBeUndefined();
    expect(Object.keys(state.activeByChat)).toHaveLength(2);
  });

  it('drops a ring that ended while the hub was away and lists ongoing group calls', () => {
    const state = run(ring, {
      type: 'chats',
      myId: ME,
      now: NOW,
      chats: [buildChat(DM, CORP_CHAT_KIND_DIRECT), buildChat(GROUP, CORP_CHAT_KIND_GROUP, {
        callId: 41, state: 'active', participantCount: 2, startedAt: EARLIER, startedById: PEER,
      })],
    });
    expect(state.session).toBeUndefined();
    expect(state.activeByChat).toEqual({ [GROUP]: { callId: 41, state: 'active', participantCount: 2 } });
  });
});

describe('corp call state: group call', () => {
  const groupCall = buildCall({
    chatId: GROUP,
    participants: [
      { employeeId: ME, fullName: 'Me' }, { employeeId: PEER, fullName: 'Peer' }, { employeeId: 9, fullName: 'Third' },
    ],
  });

  it('joins, tracks participants and ends with the call', () => {
    let state = run(startGroup);
    expect(state.session?.phase).toBe('joining');

    state = reduceCorpCalls(state, { type: 'joined', join: buildJoin(groupCall) });
    expect(state.session).toMatchObject({ phase: 'active', canEndForAll: true });
    expect(state.session?.participants).toHaveLength(3);
    expect(state.activeByChat[GROUP].participantCount).toBe(3);

    state = reduceCorpCalls(state, {
      type: 'updated', call: { ...groupCall, active: false, state: 'ended', participants: [], endReason: 'ended' },
    });
    expect(state.session).toBeUndefined();
    expect(state.notice).toBe('TeleTwinCallEnded');
    expect(state.activeByChat[GROUP]).toBeUndefined();
  });

  it('listens only in a channel where I cannot post', () => {
    const state = run({ ...startGroup, withVideo: true }, { type: 'joined', join: buildJoin(groupCall, false) });
    expect(state.session).toMatchObject({ canPublish: false, withVideo: false });
  });

  it('ignores snapshots of other chats and older calls', () => {
    const joined = run(startGroup, { type: 'joined', join: buildJoin(groupCall) });
    const other = reduceCorpCalls(joined, { type: 'updated', call: buildCall({ chatId: 99, active: false }) });
    expect(other.session).toBe(joined.session);
    const older = reduceCorpCalls(joined, { type: 'updated', call: { ...groupCall, callId: 40, active: false } });
    expect(older.session).toBe(joined.session);
  });

  it('a session reset (logout, revoke) clears everything', () => {
    const state = run(startGroup, { type: 'joined', join: buildJoin(groupCall) }, { type: 'reset' });
    expect(state).toEqual(INITIAL_CORP_CALLS_STATE);
  });
});
