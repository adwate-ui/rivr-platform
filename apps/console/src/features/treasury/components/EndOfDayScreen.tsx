import { useChipInventory, useEodCloses, useStaffVenue, useTreasury, type ChipCountLine, type EodClose, type Treasury } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Heading, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { CloseCard } from './CloseCard.tsx';
import { CloseShiftForm } from './CloseShiftForm.tsx';

/**
 * End of day (#45; scope-v1 module 5): a cashier closes the cage's shift, counting the drawer and the chips
 * and taking the receipts from the bank statement; each is set against the ledger. A shift closes to zero
 * variance; any variance is an anomaly whose reason a manager who neither opened nor closed it gives. It
 * sits with the Treasury, whose shift it closes and whose chip count it reuses.
 */
export function EndOfDayScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.endOfDay.title');
  const { permissions, venueId } = staff.venue;
  if (!permissions.includes('ledger.read')) return <Screen title={title} status="error" errorText={t('console.endOfDay.notAllowed')} />;
  return <EndOfDay title={title} venueId={venueId} canClose={permissions.includes('cage.transact')} />;
}

function EndOfDay({ title, venueId, canClose }: { title: string; venueId: string; canClose: boolean }) {
  const treasury = useTreasury(venueId);
  const chips = useChipInventory(venueId);
  const closes = useEodCloses(venueId);
  const [notice, setNotice] = useState<string | null>(null);
  if (treasury.isPending || chips.isPending || closes.isPending) return <Screen title={title} status="loading" />;
  if (treasury.isError || chips.isError || closes.isError) {
    return <Screen title={title} status="error" onRetry={() => { void treasury.refetch(); void chips.refetch(); void closes.refetch(); }} />;
  }
  return (
    <Screen title={title}>
      <Stack gap={8}>
        {notice === null ? null : <Text tone="money">{notice}</Text>}
        <CloseSection venueId={venueId} treasury={treasury.data} lines={chips.data.lines} canClose={canClose}
          onClosed={() => setNotice(t('console.endOfDay.closed'))} />
        <Closes venueId={venueId} closes={closes.data} />
      </Stack>
    </Screen>
  );
}

/** Closing the open shift, for a cashier; with no shift open, where to open one. */
function CloseSection({ venueId, treasury, lines, canClose, onClosed }: {
  venueId: string;
  treasury: Treasury;
  lines: readonly ChipCountLine[];
  canClose: boolean;
  onClosed: () => void;
}) {
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.endOfDay.close')}</Heading>
      {treasury.shift === null ? <Text tone="muted">{t('console.endOfDay.noShift')}</Text> : null}
      {treasury.shift !== null && !canClose ? <Text tone="muted">{t('console.endOfDay.openNotYours')}</Text> : null}
      {treasury.shift !== null && canClose ? <CloseShiftForm key={treasury.shift.shiftId} venueId={venueId} lines={lines} onClosed={onClosed} /> : null}
    </Stack>
  );
}

/** The venue's latest closes and any anomaly still waiting, newest first. */
function Closes({ venueId, closes }: { venueId: string; closes: readonly EodClose[] }) {
  return (
    <Stack gap={6} divided>
      <Heading level={2}>{t('console.endOfDay.closes')}</Heading>
      {closes.length === 0 ? <Text tone="muted">{t('console.endOfDay.noCloses')}</Text> : null}
      {closes.map((close) => <CloseCard key={close.closeId} venueId={venueId} close={close} />)}
    </Stack>
  );
}
