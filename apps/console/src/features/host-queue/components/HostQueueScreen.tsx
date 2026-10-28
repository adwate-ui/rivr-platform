import { useStaffVenue } from '@rivr/db';
import { useHostQueue } from '@rivr/db/hostQueue';
import { t } from '@rivr/i18n';
import { Screen, Stack, Text } from '@rivr/ui';
import { HostItem } from './HostItem.tsx';

/** The venue's lapsed regulars, each with its call. */
function HostQueue({ venueId }: { venueId: string }) {
  const queue = useHostQueue(venueId);
  const title = t('console.hostQueue.title');
  if (queue.data === undefined) return <Screen title={title} status={queue.isError ? 'error' : 'loading'} onRetry={() => void queue.refetch()} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <Text tone="muted">{t('console.hostQueue.hint')}</Text>
        {queue.data.length === 0 ? <Text tone="muted">{t('console.hostQueue.none')}</Text> : null}
        {queue.data.map((item) => <HostItem key={item.itemId} venueId={venueId} item={item} />)}
      </Stack>
    </Screen>
  );
}

/** The host queue (#165; docs/contracts/lane-d.md features/host-queue), for staff with members.manage. */
export function HostQueueScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('members.manage')) {
    return <Screen title={t('console.hostQueue.title')} status="error" errorText={t('console.hostQueue.notAllowed')} />;
  }
  return <HostQueue venueId={staff.venue.venueId} />;
}
