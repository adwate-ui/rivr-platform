import { useAuthStatus, useControlState, useCurrentDown, useDownActions, useMyDevice } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, KillSwitchBanner, Screen, TabletShell, Text } from '@rivr/ui';
import type { ReactNode } from 'react';

interface FrameProps {
  children: ReactNode;
  /** What the tablet shows until it is paired, or once its pairing is revoked. */
  unpaired: ReactNode;
  /** What a tablet fixed to a table shows between downs: dealer sign-in. */
  signIn: ReactNode;
}

interface DownFrameProps {
  tableName: string;
  banner: ReactNode;
  signIn: ReactNode;
  children: ReactNode;
}

/**
 * A tablet fixed to a table: between downs, dealer sign-in; during a down, the tablet's screens with
 * who is dealing, since when, and End of down in the header. A failed check keeps what was known.
 */
function DownFrame({ tableName, banner, signIn, children }: DownFrameProps) {
  const down = useCurrentDown(true);
  const { end } = useDownActions();
  const title = t('tablet.title');
  if (down.isPending) return <TabletShell tableName={tableName} banner={banner}><Screen title={title} status="loading" /></TabletShell>;
  if (down.data === undefined) {
    return <TabletShell tableName={tableName} banner={banner}><Screen title={title} status="error" onRetry={() => void down.refetch()} /></TabletShell>;
  }
  if (down.data === null) return <TabletShell tableName={tableName} banner={banner}>{signIn}</TabletShell>;
  const actions = (
    <>
      <Text variant="small">{t('tablet.dealerSignIn.down', { name: down.data.fullName, time: formatTime(new Date(down.data.startedAt)) })}</Text>
      <Button variant="secondary" isLoading={end.isPending} onClick={() => void end.mutateAsync()}>{t('tablet.dealerSignIn.endDown')}</Button>
    </>
  );
  return <TabletShell tableName={tableName} actions={actions} banner={banner}>{children}</TabletShell>;
}

/**
 * The dealer tablet's frame: the table it is fixed to (#41) and the kill-switch banner. A tablet
 * that is not signed in as a paired device shows `unpaired` instead of its screens; one fixed to a
 * table asks a dealer to sign in between downs. Lane B adds the offline banner from @rivr/offline.
 */
export function Frame({ children, unpaired, signIn }: FrameProps) {
  const { isVenueFrozen } = useControlState();
  const authStatus = useAuthStatus();
  const device = useMyDevice();
  const banner = isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null;
  const title = t('tablet.title');
  if (authStatus === 'loading' || (authStatus === 'signed-in' && device.isPending)) {
    return <TabletShell tableName={title} banner={banner}><Screen title={title} status="loading" /></TabletShell>;
  }
  // A failed check every 30 seconds keeps what was known: a dealer mid-hand keeps their screen.
  if (device.isError && device.data === undefined) {
    return <TabletShell tableName={title} banner={banner}><Screen title={title} status="error" onRetry={() => void device.refetch()} /></TabletShell>;
  }
  if (authStatus === 'signed-out' || !device.data) {
    return <TabletShell tableName={t('tablet.pairing.notPaired')} banner={banner}>{unpaired}</TabletShell>;
  }
  // A tablet's table id and name are null together: not yet fixed to a table.
  if (device.data.tableName === null) {
    return <TabletShell tableName={t('tablet.unassignedTable')} banner={banner}>{children}</TabletShell>;
  }
  return <DownFrame tableName={device.data.tableName} banner={banner} signIn={signIn}>{children}</DownFrame>;
}
