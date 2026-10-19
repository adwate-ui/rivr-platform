import { useAuthStatus, useControlState, useMyDevice } from '@rivr/db';
import { t } from '@rivr/i18n';
import { KillSwitchBanner, Screen, TabletShell } from '@rivr/ui';
import type { ReactNode } from 'react';

interface FrameProps {
  children: ReactNode;
  /** What the tablet shows until it is paired, or once its pairing is revoked. */
  unpaired: ReactNode;
}

/**
 * The dealer tablet's frame: the table it is fixed to (#41) and the kill-switch banner. A tablet
 * that is not signed in as a paired device shows `unpaired` instead of its screens. Lane B adds the
 * offline banner from @rivr/offline.
 */
export function Frame({ children, unpaired }: FrameProps) {
  const { isVenueFrozen } = useControlState();
  const authStatus = useAuthStatus();
  const device = useMyDevice();
  const banner = isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null;
  const title = t('tablet.handEntry.title');
  if (authStatus === 'loading' || (authStatus === 'signed-in' && device.isPending)) {
    return <TabletShell tableName="" banner={banner}><Screen title={title} status="loading" /></TabletShell>;
  }
  if (device.isError) {
    return <TabletShell tableName="" banner={banner}><Screen title={title} status="error" onRetry={() => void device.refetch()} /></TabletShell>;
  }
  if (authStatus === 'signed-out' || !device.data) {
    return <TabletShell tableName={t('tablet.pairing.notPaired')} banner={banner}>{unpaired}</TabletShell>;
  }
  return (
    <TabletShell tableName={device.data.tableName ?? t('tablet.unassignedTable')} banner={banner}>
      {children}
    </TabletShell>
  );
}
