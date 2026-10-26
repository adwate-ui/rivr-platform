import { useAuthStatus, useControlState, useCurrentDown, useMyDevice, type DownCount, type MyDevice } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, KillSwitchBanner, Screen, Stack, TabletShell, Text } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { DownCountLine, EndDownForm } from './EndDownForm.tsx';
import { HandQueueBanner } from './HandQueueBanner.tsx';

interface FrameProps {
  children: ReactNode;
  /** What the tablet shows until it is paired, or once its pairing is revoked. */
  unpaired: ReactNode;
  /** What a tablet fixed to a table shows between downs: dealer sign-in. */
  signIn: ReactNode;
  /** What a door kiosk shows in place of the table's screens (decision 0164): the card scanner. */
  door: ReactNode;
}

interface TableFrameProps {
  device: MyDevice;
  banner: ReactNode;
  signIn: ReactNode;
  children: ReactNode;
}

/**
 * A paired tablet. Not yet fixed to a table, its screens say so. Fixed to one: between downs,
 * dealer sign-in, under what the last down closed with; during a down, the tablet's screens with
 * who is dealing, since when, and End of down in the header, which asks for the drop-box count
 * (#44). A failed check keeps what was known; a failed End of down says so, so the dealer does not
 * walk away from a down still open.
 */
function TableFrame({ device, banner, signIn, children }: TableFrameProps) {
  const down = useCurrentDown(device.tableId);
  // End of down belongs to the down it was opened for: once that down is over (ended here, by the
  // 30-second check, or by an answer lost after the database closed it), the next dealer starts on
  // hand entry.
  const [endingDownId, setEndingDownId] = useState<string | null>(null);
  const [lastCount, setLastCount] = useState<DownCount | null>(null);
  const title = t('tablet.title');
  // A tablet's table id and name are null together: not yet fixed to a table.
  if (device.tableId === null || device.tableName === null) {
    return <TabletShell tableName={t('tablet.unassignedTable')} banner={banner}>{children}</TabletShell>;
  }
  // A training tablet says so, so nobody takes it for one at a live table (#50).
  const tableName = device.isPractice ? t('tablet.practiceTable', { table: device.tableName }) : device.tableName;
  if (down.isPending) return <TabletShell tableName={tableName} banner={banner}><Screen title={title} status="loading" /></TabletShell>;
  if (down.data === undefined) {
    return <TabletShell tableName={tableName} banner={banner}><Screen title={title} status="error" onRetry={() => void down.refetch()} /></TabletShell>;
  }
  if (down.data === null) {
    return (
      <TabletShell tableName={tableName} banner={banner}>
        <Stack gap={6}>{lastCount === null ? null : <DownCountLine count={lastCount} />}{signIn}</Stack>
      </TabletShell>
    );
  }
  const current = down.data;
  const isEnding = endingDownId === current.downId;
  const actions = (
    <>
      <Text variant="small">{t('tablet.dealerSignIn.down', { name: current.fullName, time: formatTime(new Date(current.startedAt)) })}</Text>
      <Button variant="secondary" isDisabled={isEnding} onClick={() => setEndingDownId(current.downId)}>{t('tablet.dealerSignIn.endDown')}</Button>
    </>
  );
  const ended = (count: DownCount) => {
    setLastCount(count);
    setEndingDownId(null);
  };
  return (
    <TabletShell tableName={tableName} actions={actions} banner={banner}>
      {isEnding ? <EndDownForm onEnded={ended} onCancel={() => setEndingDownId(null)} /> : children}
    </TabletShell>
  );
}

/**
 * The dealer tablet's frame: the table it is fixed to (#41) and the kill-switch banner. A tablet
 * that is not signed in as a paired device shows `unpaired` instead of its screens; one fixed to a
 * table asks a dealer to sign in between downs; a door kiosk shows `door`, under its name. Lane B adds the offline banner from @rivr/offline.
 */
export function Frame({ children, unpaired, signIn, door }: FrameProps) {
  const { isVenueFrozen } = useControlState();
  const authStatus = useAuthStatus();
  const device = useMyDevice();
  const banner = <>{isVenueFrozen ? <KillSwitchBanner audience="staff" /> : null}<HandQueueBanner /></>;
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
  if (device.data.isDoor) return <TabletShell tableName={device.data.name} banner={banner}>{door}</TabletShell>;
  return <TableFrame device={device.data} banner={banner} signIn={signIn}>{children}</TableFrame>;
}
