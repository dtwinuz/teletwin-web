import { memo, useEffect } from '../../lib/teact/teact';

import type { CorpApp } from '../api';

import buildClassName from '../../util/buildClassName';
import {
  getCorpAppIcon, getCorpApps, getCorpAppsStatus, setOpenedCorpApp,
} from '../apps';
import { corpEngine } from '../engine';

import useDerivedState from '../../hooks/useDerivedState';
import useLang from '../../hooks/useLang';
import useLastCallback from '../../hooks/useLastCallback';

import Button from '../../components/ui/Button';
import ListItem from '../../components/ui/ListItem';
import Loading from '../../components/ui/Loading';

import styles from './CorpApps.module.scss';

type OwnProps = {
  isActive?: boolean;
};

// The "Ilovalar" folder tab: corp web apps instead of the chat list. Opening one shows `CorpAppFrame`.
const CorpAppsPanel = ({ isActive }: OwnProps) => {
  const lang = useLang();
  const apps = useDerivedState(getCorpApps);
  const status = useDerivedState(getCorpAppsStatus);

  // The list is refreshed every time the tab is shown, a stale list stays visible meanwhile
  useEffect(() => {
    if (isActive) void corpEngine.loadApps();
  }, [isActive]);

  const handleRetry = useLastCallback(() => {
    void corpEngine.loadApps();
  });

  const handleOpen = useLastCallback((e: React.MouseEvent<HTMLElement>, app: CorpApp) => {
    setOpenedCorpApp(app);
  });

  function renderIcon(app: CorpApp) {
    const icon = getCorpAppIcon(app);

    return (
      <div className={styles.icon} aria-hidden>
        {icon.kind === 'image'
          ? <img className={styles.iconImage} src={icon.src} alt="" draggable={false} />
          : icon.text}
      </div>
    );
  }

  function renderContent() {
    if (apps.length) {
      return apps.map((app) => (
        <ListItem
          key={String(app.id)}
          leftElement={renderIcon(app)}
          ripple
          clickArg={app}
          onClick={handleOpen}
        >
          <span className={styles.title} dir="auto">{app.title}</span>
        </ListItem>
      ));
    }

    if (status === 'error') {
      return (
        <div className={styles.state}>
          <span>{lang('TeleTwinAppsError')}</span>
          <Button size="smaller" fluid={false} isText onClick={handleRetry}>{lang('TeleTwinAppsRetry')}</Button>
        </div>
      );
    }

    if (status === 'loaded') {
      return <div className={styles.state}>{lang('TeleTwinAppsEmpty')}</div>;
    }

    return (
      <div className={styles.state}>
        <Loading className={styles.loading} />
        <span>{lang('TeleTwinAppsLoading')}</span>
      </div>
    );
  }

  return (
    <div className={buildClassName(styles.panel, 'custom-scroll')} data-corp-apps>
      {renderContent()}
    </div>
  );
};

export default memo(CorpAppsPanel);
