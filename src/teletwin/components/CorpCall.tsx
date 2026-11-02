import { memo, useEffect, useRef } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { CorpCallMember } from '../calls';

import buildClassName from '../../util/buildClassName';
import {
  acceptCorpCall, clearCorpCallNotice, endCorpCallForAll, getCorpCallMedia, getCorpCallsEnabled, getCorpCallState,
  hangUpCorpCall, rejectCorpCall, startCorpCall, startCorpCallAudio, toggleCorpCallMute, toggleCorpCallVideo,
} from '../calls';
import { corpEngine } from '../engine';
import { getServerChatId, isCorpChatId } from '../ids';
import { isCorpDirectChat } from '../state';

import useDerivedState from '../../hooks/useDerivedState';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';

import styles from './CorpCall.module.scss';

// Chat header: starts a call in a corp chat, or joins the ongoing one
export const CorpCallButton = ({ chatId }: { chatId: string }) => {
  const lang = useLang();
  const isEnabled = useDerivedState(getCorpCallsEnabled);
  const state = useDerivedState(getCorpCallState);
  const serverChatId = isCorpChatId(chatId) ? getServerChatId(chatId) : 0;
  const ongoing = serverChatId ? state.activeByChat[serverChatId] : undefined;
  const isInThisCall = state.session?.chatId === serverChatId;

  const handleClick = useLastCallback(() => {
    const info = corpEngine.getChatInfo(serverChatId);
    if (!info) return;
    void startCorpCall({
      chatId: serverChatId,
      isDirect: isCorpDirectChat(info),
      title: info.title,
      canEndForAll: Boolean(info.isAdmin),
    });
  });

  if (!isEnabled || !serverChatId || !corpEngine.getChatInfo(serverChatId)) return undefined;
  const isJoinable = ongoing?.state === 'active' && !isInThisCall;

  return (
    <Button
      round
      color="translucent"
      size="smaller"
      className={buildClassName(isJoinable && styles.joinable)}
      disabled={Boolean(state.session)}
      onClick={handleClick}
      ariaLabel={lang(isJoinable ? 'TeleTwinCallJoin' : 'TeleTwinCall')}
      iconName="phone"

    />
  );
};

// Incoming ring, the outgoing ring and the active call panel; mounted once in `CorpRoot`
const CorpCallComponent = () => {
  const lang = useLang();
  const { session, notice } = useDerivedState(getCorpCallState);
  const media = useDerivedState(getCorpCallMedia);

  useEffect(() => {
    if (!notice) return;
    getActions().showNotification({ message: { key: notice } });
    clearCorpCallNotice();
  }, [notice]);

  const handleAccept = useLastCallback(() => void acceptCorpCall());
  const handleAcceptVideo = useLastCallback(() => void acceptCorpCall(true));
  const handleMute = useLastCallback(() => void toggleCorpCallMute());
  const handleVideo = useLastCallback(() => void toggleCorpCallVideo());

  if (!session) return undefined;

  if (session.phase === 'incoming') {
    return (
      <Modal isOpen title={lang('TeleTwinCallIncoming')} onClose={rejectCorpCall} isSlim>
        <div className={styles.incoming} data-corp-call="incoming">
          <div className={styles.avatar}>{getInitials(session.title)}</div>
          <div className={styles.name}>{session.title}</div>
          <div className={styles.actions}>
            <Button
              color="danger"
              round
              onClick={rejectCorpCall}
              ariaLabel={lang('TeleTwinCallDecline')}
              iconName="phone-discard"
            />
            {session.withVideo && (
              <Button
                color="green"
                round
                onClick={handleAcceptVideo}
                ariaLabel={lang('TeleTwinCallVideo')}
                iconName="video"
              />
            )}
            <Button
              color="green"
              round
              onClick={handleAccept}
              ariaLabel={lang('TeleTwinCallAccept')}
              iconName="phone"
            />
          </div>
        </div>
      </Modal>
    );
  }

  const status = session.phase === 'outgoing' ? lang('TeleTwinCallRinging')
    : (session.phase === 'joining' || !media.isConnected) ? lang('TeleTwinCallConnecting')
      : lang('TeleTwinCallParticipants', { count: media.members.length });
  const videoMembers = media.members.filter((member) => member.videoTrack);

  return (
    <div
      className={styles.panel}
      data-corp-call={session.phase}
      data-corp-call-connected={media.isConnected || undefined}
    >
      <div className={styles.header}>
        <div className={styles.title}>{session.title}</div>
        <div className={styles.status}>{status}</div>
      </div>
      {Boolean(videoMembers.length) && (
        <div className={styles.videos}>
          {videoMembers.map((member) => <CorpCallVideo key={member.identity} member={member} />)}
        </div>
      )}
      {session.phase !== 'outgoing' && (
        <ul className={styles.members}>
          {media.members.map((member) => (
            <li
              key={member.identity}
              className={buildClassName(styles.member, member.isSpeaking && styles.speaking)}
              data-corp-call-member={member.identity}
            >
              <span className={styles.memberName}>
                {member.isLocal ? `${member.name} (${lang('TeleTwinCallYou')})` : member.name}
              </span>
              {member.isMuted && <span className={styles.muted} aria-hidden>🔇</span>}
            </li>
          ))}
        </ul>
      )}
      {media.isAudioBlocked && (
        <Button size="smaller" color="translucent-primary" onClick={startCorpCallAudio}>
          {lang('TeleTwinCallEnableAudio')}
        </Button>
      )}
      <div className={styles.controls}>
        {session.canPublish && (
          <>
            <Button
              round
              size="smaller"
              color={media.isMuted ? 'translucent-bordered' : 'translucent'}
              disabled={!media.isConnected}
              onClick={handleMute}
              ariaLabel={lang(media.isMuted ? 'TeleTwinCallUnmute' : 'TeleTwinCallMute')}
              iconName="microphone"
            />
            <Button
              round
              size="smaller"
              color={media.isVideoOn ? 'translucent-primary' : 'translucent'}
              disabled={!media.isConnected}
              onClick={handleVideo}
              ariaLabel={lang('TeleTwinCallVideo')}
              iconName={media.isVideoOn ? 'video' : 'video-stop'}
            />
          </>
        )}
        {session.canEndForAll && !session.isDirect && session.phase === 'active' && (
          <Button size="smaller" color="danger" isText onClick={endCorpCallForAll}>
            {lang('TeleTwinCallEndForAll')}
          </Button>
        )}
        <Button
          round
          size="smaller"
          color="danger"
          onClick={hangUpCorpCall}
          ariaLabel={lang('TeleTwinCallLeave')}
          iconName="phone-discard"
        />
      </div>
    </div>
  );
};

export const CorpCall = memo(CorpCallComponent);

const CorpCallVideo = ({ member }: { member: CorpCallMember }) => {
  const ref = useRef<HTMLVideoElement>();
  const { videoTrack } = member;

  useEffect(() => {
    const element = ref.current;
    if (!element || !videoTrack) return undefined;
    videoTrack.attach(element);
    return () => {
      videoTrack.detach(element);
    };
  }, [videoTrack]);

  return (
    <div className={styles.video}>
      <video
        ref={ref}
        autoPlay
        playsInline
        muted
        className={buildClassName(styles.videoElement, member.isLocal && styles.mirrored)}
      />
      <span className={styles.videoName}>{member.name}</span>
    </div>
  );
};

function getInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0].toUpperCase()).join('');
}
