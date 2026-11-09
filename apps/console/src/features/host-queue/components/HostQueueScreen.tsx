import { useStaffVenue } from '@rivr/db';
import { useHostQueue, type HostQueueItem } from '@rivr/db/hostQueue';
import { formatDate, t } from '@rivr/i18n';
import { Box, PickList, Screen, SplitView, Text } from '@rivr/ui';
import { useState } from 'react';
import { HostItem } from './HostItem.tsx';

/** A lapsed regular's line in the list: when they were last here and how often before. */
const lineOf = (item: HostQueueItem) => t('console.hostQueue.listLine', { last: formatDate(new Date(item.lastVisitAt)), visits: String(item.visits) });

/** The queue beside the call open: the one chosen, or the longest gone, which a phone leaves out until one is chosen. */
function Queue({ venueId, items }: { venueId: string; items: readonly HostQueueItem[] }) {
  const [chosenId, setChosenId] = useState<string | null>(null);
  const chosen = items.find((item) => item.itemId === chosenId);
  const open = chosen ?? items[0];
  return (
    <SplitView layout="even" isChosen={chosen !== undefined} backLabel={t('console.hostQueue.back')} onBack={() => setChosenId(null)}
      list={<PickList label={t('console.hostQueue.list')} current={open?.itemId ?? null} onPick={setChosenId} emptyText={t('console.hostQueue.none')}
        groups={[{ items: items.map((item) => ({ id: item.itemId, title: item.fullName, detail: lineOf(item) })) }]} />}
      detail={open === undefined ? null : (
        <Box surface="raised" radius="md" padding={5}><HostItem key={open.itemId} venueId={venueId} item={open} /></Box>
      )} />
  );
}

/** The venue's lapsed regulars, longest gone first, and the call to the one open (console v3). */
export function HostQueue({ venueId }: { venueId: string }) {
  const queue = useHostQueue(venueId);
  const title = t('console.hostQueue.title');
  if (queue.data === undefined) {
    return queue.isError
      ? <Screen title={title} status="error" onRetry={() => void queue.refetch()} />
      : <Screen title={title} status="loading" loadingLook="rows" />;
  }
  // A queue with nothing in it is one line on a raised panel, as on KYC review, Hand over and Spins waiting (audit F-206).
  if (queue.data.length === 0) return <Screen title={title}><Box surface="raised" radius="md" padding={4}><Text variant="small" tone="muted">{t('console.hostQueue.none')}</Text></Box></Screen>;
  return (
    <Screen title={title}>
      <Queue venueId={venueId} items={queue.data} />
    </Screen>
  );
}

/** The host queue (#165; docs/contracts/lane-d.md features/host-queue), for staff with host_queue.manage: hosts and admins. */
export function HostQueueScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('host_queue.manage')) {
    return <Screen title={t('console.hostQueue.title')} status="error" errorText={t('console.hostQueue.notAllowed')} />;
  }
  return <HostQueue venueId={staff.venue.venueId} />;
}
