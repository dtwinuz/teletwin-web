import { memo, useEffect, useState } from '../../lib/teact/teact';
import { getActions } from '../../global';

import type { CorpApp } from '../api';

import captureEscKeyListener from '../../util/captureEscKeyListener';
import { issueCorpAppToken } from '../api';
import { buildCorpAppFrameUrl, getOpenedCorpApp, setOpenedCorpApp } from '../apps';
import { corpEngine } from '../engine';

import useDerivedState from '../../hooks/useDerivedState';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../../components/ui/Button';
import Loading from '../../components/ui/Loading';
import Portal from '../../components/ui/Portal';

import styles from './CorpApps.module.scss';

const FRAME_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-downloads';
const FRAME_ALLOW = 'clipboard-write; camera';

// Every open, reload and "open in new tab" asks for a fresh 60 s token: it is only good for the first page load
async function requestCorpAppUrl(app: CorpApp) {
  const credentials = corpEngine.credentials;
  if (!credentials) throw new Error('No corp session');

  let token: string;
  try {
    ({ token } = await issueCorpAppToken(credentials.server, credentials.token, app.id));
  } catch (err) {
    corpEngine.handleFailure(err);
    throw err;
  }

  const url = token ? buildCorpAppFrameUrl(app.url, token) : undefined;
  if (!url) throw new Error('Invalid app url');

  return url;
}

// A corp web app in an iframe: a centered window on desktop, full screen on mobile. Escape closes it.
const CorpAppFrameComponent = () => {
  const lang = useLang();
  const app = useDerivedState(getOpenedCorpApp);
  const [frameUrl, setFrameUrl] = useState<string | undefined>();
  const [isFailed, setIsFailed] = useState(false);
  const [isFrameLoaded, setIsFrameLoaded] = useState(false);
  const [loadCount, setLoadCount] = useState(0);

  useEffect(() => {
    setFrameUrl(undefined);
    setIsFailed(false);
    setIsFrameLoaded(false);
    if (!app) return undefined;

    let isActual = true;
    requestCorpAppUrl(app).then((url) => {
      if (isActual) setFrameUrl(url);
    }, () => {
      if (isActual) setIsFailed(true);
    });

    return () => {
      isActual = false;
    };
  }, [app, loadCount]);

  const handleClose = useLastCallback(() => setOpenedCorpApp(undefined));

  useEffect(() => (app ? captureEscKeyListener(handleClose) : undefined), [app, handleClose]);

  const handleReload = useLastCallback(() => setLoadCount((count) => count + 1));

  const handleFrameLoad = useLastCallback(() => setIsFrameLoaded(true));

  const handleOpenInNewTab = useLastCallback(async () => {
    if (!app) return;
    // Opened synchronously so the popup blocker accepts it, the address is set once the token arrives
    const newWindow = window.open('', '_blank');
    // The app page must not reach back into TeleTwin through `window.opener`
    // eslint-disable-next-line no-null/no-null
    if (newWindow) newWindow.opener = null;

    try {
      const url = await requestCorpAppUrl(app);
      if (newWindow) {
        newWindow.location.replace(url);
      } else {
        window.open(url, '_blank', 'noopener,noreferrer');
      }
      handleClose();
    } catch {
      newWindow?.close();
      getActions().showNotification({ message: { key: 'TeleTwinAppsOpenError' } });
    }
  });

  if (!app) return undefined;

  return (
    <Portal>
      <div className={styles.overlay} onClick={handleClose} data-corp-app-frame>
        <div
          className={styles.window}
          role="dialog"
          aria-label={app.title}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={styles.header}>
            <div className={styles.headerTitle} dir="auto">{app.title}</div>
            <Button
              round
              size="smaller"
              color="translucent"
              iconName="reload"
              ariaLabel={lang('TeleTwinAppsReload')}
              onClick={handleReload}
            />
            <Button
              round
              size="smaller"
              color="translucent"
              iconName="open-in-new-tab"
              ariaLabel={lang('TeleTwinAppsOpenInNewTab')}
              onClick={() => void handleOpenInNewTab()}
            />
            <Button
              round
              size="smaller"
              color="translucent"
              iconName="close"
              ariaLabel={lang('TeleTwinAppsClose')}
              onClick={handleClose}
            />
          </div>
          <div className={styles.body}>
            {frameUrl && (
              <iframe
                key={`${app.id}-${loadCount}`}
                className={styles.frame}
                title={app.title}
                sandbox={FRAME_SANDBOX}
                allow={FRAME_ALLOW}
                referrerPolicy="no-referrer"
                src={frameUrl}
                onLoad={handleFrameLoad}
              />
            )}
            {isFailed && (
              <div className={styles.state}>
                <span>{lang('TeleTwinAppsOpenError')}</span>
                <Button size="smaller" fluid={false} isText onClick={handleReload}>{lang('TeleTwinAppsRetry')}</Button>
              </div>
            )}
            {!isFailed && !isFrameLoaded && (
              <div className={styles.frameLoading}>
                <Loading className={styles.loading} />
              </div>
            )}
          </div>
        </div>
      </div>
    </Portal>
  );
};

export const CorpAppFrame = memo(CorpAppFrameComponent);
