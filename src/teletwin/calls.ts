// Corp calls on top of LiveKit (`docs/calls-design.md` in the server repo):
//  - `POST /chats/{id}/call` -> join token -> `room.connect(url, token)`; the first `POST` of a direct chat rings the
//    other side (hub `call_ring`), their `POST` answers it, `/decline` refuses it, the caller's `DELETE` cancels it
//  - hub `call_updated` / `call_ring` / `call_ring_ended` and `GET /chats` (`chat.call`) drive `callState.ts`
//  - remote audio plays through hidden `<audio>` elements; the session ends on hang up, on a LiveKit disconnect
//    (the server removes revoked employees) and when the corp session stops (logout, revoke, 401)
// The module has no Web A global state dependencies: `index.ts` provides credentials through `setCorpCallEnv`.
import type {
  LocalParticipant, Participant, RemoteParticipant, RemoteTrack, Room, Track,
} from 'livekit-client';

import type {
  CorpCall, CorpCallRing, CorpCallRingEnded, CorpChatInfo,
} from './api';
import type { CorpCallEvent, CorpCallNotice, CorpCallsState } from './callState';

import { createSignal } from '../util/signals';
import {
  CorpApiError, declineCorpCall, endCorpCall, isCorpUnauthorized, joinCorpCall, leaveCorpCall,
} from './api';
import { getJoinFailureNotice, INITIAL_CORP_CALLS_STATE, reduceCorpCalls } from './callState';

export interface CorpCallEnv {
  getCredentials: () => { server: string; token: string; employeeId: number } | undefined;
  // A 401 revokes the corp session
  handleFailure: (err: unknown) => void;
  // Milliseconds, server clock
  getNow: () => number;
}

export type CorpCallHubEvent =
  | { type: 'config'; isEnabled: boolean }
  | { type: 'chats'; chats: CorpChatInfo[] }
  | { type: 'updated'; call: CorpCall }
  | { type: 'ring'; ring: CorpCallRing }
  | { type: 'ringEnded'; ended: CorpCallRingEnded };

export interface CorpCallMember {
  // LiveKit identity, `e{employeeId}`
  identity: string;
  employeeId?: number;
  name: string;
  isLocal: boolean;
  isMuted: boolean;
  isSpeaking: boolean;
  videoTrack?: Track;
}

export interface CorpCallMedia {
  isConnected: boolean;
  isMuted: boolean;
  isVideoOn: boolean;
  // The browser blocked autoplay: remote audio starts after a click
  isAudioBlocked: boolean;
  members: CorpCallMember[];
}

const INITIAL_MEDIA: CorpCallMedia = {
  isConnected: false, isMuted: false, isVideoOn: false, isAudioBlocked: false, members: [],
};
const RE_IDENTITY = /^e(\d+)$/;
const AUDIO_CONTAINER_ID = 'corp-call-audio';
const ROOM_DELETED_GRACE = 3000;

const [getCorpCallsEnabled, setCorpCallsEnabled] = createSignal(false);
const [getCorpCallState, setCorpCallState] = createSignal<CorpCallsState>(INITIAL_CORP_CALLS_STATE);
const [getCorpCallMedia, setCorpCallMedia] = createSignal<CorpCallMedia>(INITIAL_MEDIA);

export { getCorpCallMedia, getCorpCallsEnabled, getCorpCallState };

let env: CorpCallEnv | undefined;
let room: Room | undefined;
let livekit: typeof import('livekit-client') | undefined;
const audioElements = new Map<string, HTMLMediaElement[]>();

export function setCorpCallEnv(newEnv: CorpCallEnv) {
  env = newEnv;
}

export function handleCorpCallHubEvent(event: CorpCallHubEvent) {
  const credentials = env?.getCredentials();
  switch (event.type) {
    case 'config':
      setCorpCallsEnabled(event.isEnabled);
      break;
    case 'chats':
      if (credentials) {
        dispatch({
          type: 'chats', chats: event.chats, myId: credentials.employeeId, now: env!.getNow(),
        });
      }
      break;
    case 'updated':
      dispatch({ type: 'updated', call: event.call });
      break;
    case 'ring':
      dispatch({ type: 'ring', ring: event.ring });
      break;
    case 'ringEnded':
      dispatch({ type: 'ringEnded', ended: event.ended });
      break;
  }
}

// The corp session stopped (logout, revoke, another account): the call is torn down without notifying the server,
// whose `RemoveParticipant` already disconnected or soon disconnects us
export function resetCorpCalls() {
  setCorpCallsEnabled(false);
  dispatch({ type: 'reset' });
}

export async function startCorpCall(options: {
  chatId: number; isDirect: boolean; title: string; withVideo?: boolean; canEndForAll?: boolean;
}) {
  if (getCorpCallState().session) return;
  dispatch({
    type: 'start',
    chatId: options.chatId,
    isDirect: options.isDirect,
    title: options.title,
    withVideo: Boolean(options.withVideo),
    canEndForAll: Boolean(options.canEndForAll),
  });
  await join(options.chatId, Boolean(options.withVideo));
}

export async function acceptCorpCall(withVideo?: boolean) {
  const session = getCorpCallState().session;
  if (session?.phase !== 'incoming') return;
  dispatch({ type: 'accept' });
  await join(session.chatId, Boolean(withVideo));
}

export function rejectCorpCall() {
  const session = getCorpCallState().session;
  if (session?.phase !== 'incoming') return;
  dispatch({ type: 'hangUp' });
  void notifyServer((server, token) => declineCorpCall(server, token, session.chatId));
}

// Leaves the call; a direct call ends for both sides, a ringing one is canceled
export function hangUpCorpCall() {
  const session = getCorpCallState().session;
  if (!session) return;
  if (session.phase === 'incoming') {
    rejectCorpCall();
    return;
  }
  dispatch({ type: 'hangUp' });
  const isCanceled = session.phase === 'outgoing' && session.isCaller;
  void notifyServer((server, token) => (
    isCanceled ? endCorpCall(server, token, session.chatId) : leaveCorpCall(server, token, session.chatId)
  ));
}

// Group and channel admins end the call for everyone
export function endCorpCallForAll() {
  const session = getCorpCallState().session;
  if (!session || session.phase === 'incoming') return;
  dispatch({ type: 'hangUp' });
  void notifyServer((server, token) => endCorpCall(server, token, session.chatId));
}

export function clearCorpCallNotice() {
  dispatch({ type: 'clearNotice' });
}

export async function toggleCorpCallMute() {
  const participant = room?.localParticipant;
  if (!participant || !getCorpCallState().session?.canPublish) return;
  try {
    await participant.setMicrophoneEnabled(!participant.isMicrophoneEnabled);
  } catch {
    setNotice('TeleTwinCallNoMicrophone');
  }
  refreshMedia();
}

export async function toggleCorpCallVideo() {
  const participant = room?.localParticipant;
  if (!participant || !getCorpCallState().session?.canPublish) return;
  try {
    await participant.setCameraEnabled(!participant.isCameraEnabled);
  } catch {
    // No camera or no permission: the call goes on with audio
  }
  refreshMedia();
}

// Called from a click: browsers start blocked remote audio only after a user gesture
export function startCorpCallAudio() {
  void room?.startAudio().then(refreshMedia, refreshMedia);
}

function dispatch(event: CorpCallEvent) {
  const previous = getCorpCallState();
  const next = reduceCorpCalls(previous, event);
  if (next === previous) return;
  setCorpCallState(next);
  if (!next.session && room) disconnectRoom();
}

// A notice that leaves the call as it is
function setNotice(notice: CorpCallNotice) {
  setCorpCallState({ ...getCorpCallState(), notice });
}

async function notifyServer(cb: (server: string, token: string) => Promise<unknown>) {
  const credentials = env?.getCredentials();
  if (!credentials) return;
  try {
    await cb(credentials.server, credentials.token);
  } catch (err) {
    // The call already ended on the server (404) or the network is down: nothing left to undo
    if (isCorpUnauthorized(err)) env!.handleFailure(err);
  }
}

async function join(chatId: number, withVideo: boolean) {
  const credentials = env?.getCredentials();
  if (!credentials) {
    dispatch({ type: 'failed', notice: 'TeleTwinCallFailed' });
    return;
  }

  let joinResult;
  try {
    [joinResult, livekit] = await Promise.all([
      joinCorpCall(credentials.server, credentials.token, chatId, withVideo),
      livekit || import('livekit-client'),
    ]);
  } catch (err) {
    if (isCorpUnauthorized(err)) {
      env!.handleFailure(err);
      return;
    }
    const apiError = err instanceof CorpApiError ? err : undefined;
    if (isCurrentJoin(chatId)) {
      dispatch({ type: 'failed', notice: getJoinFailureNotice(apiError?.status, apiError?.code) });
    }
    return;
  }

  // Hung up while the token was on its way
  if (!isCurrentJoin(chatId)) {
    void notifyServer((server, token) => leaveCorpCall(server, token, chatId));
    return;
  }

  dispatch({ type: 'joined', join: joinResult });
  const session = getCorpCallState().session;
  if (!session) return;

  const newRoom = new livekit.Room({ adaptiveStream: true, dynacast: true });
  room = newRoom;
  subscribeRoom(newRoom);

  try {
    await newRoom.connect(joinResult.url, joinResult.token);
  } catch {
    if (room !== newRoom) return;
    dispatch({ type: 'failed', notice: 'TeleTwinCallFailed' });
    void notifyServer((server, token) => leaveCorpCall(server, token, chatId));
    return;
  }
  if (room !== newRoom) return;

  if (session.canPublish) {
    try {
      await newRoom.localParticipant.setMicrophoneEnabled(true);
    } catch {
      setNotice('TeleTwinCallNoMicrophone');
    }
    if (session.withVideo && room === newRoom) {
      await newRoom.localParticipant.setCameraEnabled(true).catch(() => undefined);
    }
  }
  if (room !== newRoom) return;
  void newRoom.startAudio().catch(() => undefined);
  refreshMedia();
}

function isCurrentJoin(chatId: number) {
  const session = getCorpCallState().session;
  return session?.chatId === chatId && session.phase !== 'incoming';
}

function subscribeRoom(target: Room) {
  const { RoomEvent, DisconnectReason } = livekit!;
  const ifCurrent = <T extends unknown[]>(handler: (...args: T) => void) => (...args: T) => {
    if (room === target) handler(...args);
  };

  target
    .on(RoomEvent.TrackSubscribed, ifCurrent((track: RemoteTrack, _publication, participant: RemoteParticipant) => {
      if (track.kind === livekit!.Track.Kind.Audio) attachAudio(track, participant.identity);
      refreshMedia();
    }))
    .on(RoomEvent.TrackUnsubscribed, ifCurrent((track: RemoteTrack) => {
      track.detach().forEach((element) => element.remove());
      refreshMedia();
    }))
    .on(RoomEvent.ParticipantConnected, ifCurrent(refreshMedia))
    .on(RoomEvent.ParticipantDisconnected, ifCurrent((participant: RemoteParticipant) => {
      removeAudio(participant.identity);
      refreshMedia();
    }))
    .on(RoomEvent.TrackMuted, ifCurrent(refreshMedia))
    .on(RoomEvent.TrackUnmuted, ifCurrent(refreshMedia))
    .on(RoomEvent.LocalTrackPublished, ifCurrent(refreshMedia))
    .on(RoomEvent.LocalTrackUnpublished, ifCurrent(refreshMedia))
    .on(RoomEvent.ActiveSpeakersChanged, ifCurrent(refreshMedia))
    .on(RoomEvent.AudioPlaybackStatusChanged, ifCurrent(refreshMedia))
    .on(RoomEvent.ConnectionStateChanged, ifCurrent(refreshMedia))
    .on(RoomEvent.Disconnected, ifCurrent((reason?: number) => {
      if (reason === DisconnectReason.ROOM_DELETED) {
        waitForCallEnd();
        return;
      }
      // Removed by the server (revoke, removal from the chat) or another device of mine joined with the same identity
      const notice = reason === DisconnectReason.PARTICIPANT_REMOVED ? 'TeleTwinCallRemoved'
        : reason === DisconnectReason.CLIENT_INITIATED ? undefined : 'TeleTwinCallEnded';
      dispatch({ type: 'failed', notice });
    }));
}

// The server ended the call (declined, canceled, timed out, ended for everyone): the hub `call_updated` that follows
// names the reason, so the session waits for it a little before ending on its own
function waitForCallEnd() {
  disconnectRoom();
  const session = getCorpCallState().session;
  if (!session) return;
  setTimeout(() => {
    const current = getCorpCallState().session;
    if (current?.chatId === session.chatId && current.callId === session.callId) {
      dispatch({ type: 'failed', notice: 'TeleTwinCallEnded' });
    }
  }, ROOM_DELETED_GRACE);
}

function disconnectRoom() {
  const current = room;
  room = undefined;
  [...audioElements.keys()].forEach(removeAudio);
  setCorpCallMedia(INITIAL_MEDIA);
  void current?.disconnect();
}

function attachAudio(track: RemoteTrack, identity: string) {
  let container = document.getElementById(AUDIO_CONTAINER_ID);
  if (!container) {
    container = document.createElement('div');
    container.id = AUDIO_CONTAINER_ID;
    container.hidden = true;
    document.body.appendChild(container);
  }
  const element = track.attach();
  container.appendChild(element);
  audioElements.set(identity, [...(audioElements.get(identity) || []), element]);
}

function removeAudio(identity: string) {
  audioElements.get(identity)?.forEach((element) => {
    element.pause();
    element.remove();
  });
  audioElements.delete(identity);
}

function refreshMedia() {
  const current = room;
  if (!current || !livekit) {
    setCorpCallMedia(INITIAL_MEDIA);
    return;
  }

  const local = current.localParticipant;
  const participants: Participant[] = [local, ...current.remoteParticipants.values()];
  setCorpCallMedia({
    isConnected: current.state === livekit.ConnectionState.Connected,
    isMuted: !local.isMicrophoneEnabled,
    isVideoOn: local.isCameraEnabled,
    isAudioBlocked: !current.canPlaybackAudio,
    members: participants.map((participant) => buildMember(participant, participant === local)),
  });
}

function buildMember(participant: Participant | LocalParticipant, isLocal: boolean): CorpCallMember {
  const employeeId = participant.identity.match(RE_IDENTITY)?.[1];
  const camera = participant.getTrackPublication(livekit!.Track.Source.Camera);

  return {
    identity: participant.identity,
    employeeId: employeeId ? Number(employeeId) : undefined,
    name: participant.name || participant.identity,
    isLocal,
    isMuted: !participant.isMicrophoneEnabled,
    isSpeaking: participant.isSpeaking,
    videoTrack: camera?.track && !camera.isMuted ? camera.track : undefined,
  };
}
