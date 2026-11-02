import { memo } from '../../lib/teact/teact';

import { CorpActivityModal } from './CorpActivity';
import { CorpCall } from './CorpCall';
import { CorpDirectoryModal } from './CorpDirectory';
import CorpDirectPicker from './CorpDirectPicker';
import CorpGate from './CorpGate';
import CorpJiraCard from './CorpJiraCard';
import { CorpMyProfileModal } from './CorpProfile';
import { CorpReminderPicker, CorpSavedModal } from './CorpSaved';
import { CorpDndWakeUpConfirm, CorpStatusModal } from './CorpStatus';
import { CorpWakeUpPicker } from './CorpWakeUp';

// Corp overlays mounted once in `Main`: the mandatory login gate, the wake-up and direct chat pickers, the issue card
// and the call
const CorpRoot = () => {
  return (
    <>
      <CorpGate />
      <CorpWakeUpPicker />
      <CorpDirectPicker />
      <CorpJiraCard />
      <CorpStatusModal />
      <CorpDndWakeUpConfirm />
      <CorpReminderPicker />
      <CorpSavedModal />
      <CorpActivityModal />
      <CorpMyProfileModal />
      <CorpDirectoryModal />
      <CorpCall />
    </>
  );
};

export default memo(CorpRoot);
