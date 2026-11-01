import { useStaffVenue } from '@rivr/db';
import { useHostQueue } from '@rivr/db/hostQueue';
import { formatNumber, t } from '@rivr/i18n';
import { Button, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { HostItem } from './HostItem.tsx';

/** How many calls the queue shows at a time: each is a whole form (F2-19). */
const PAGE = 20;

/** The venue's lapsed regulars, each with its call, twenty at a time. */
export function HostQueue({ venueId }: { venueId: string }) {
  const queue = useHostQueue(venueId);
  const [shown, setShown] = useState(PAGE);
  const title = t('console.hostQueue.title');
  if (queue.data === undefined) return <Screen title={title} status={queue.isError ? 'error' : 'loading'} onRetry={() => void queue.refetch()} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <Text tone="muted">{t('console.hostQueue.hint')}</Text>
        {queue.data.length === 0 ? <Text tone="muted">{t('console.hostQueue.none')}</Text> : null}
        {queue.data.slice(0, shown).map((item) => <HostItem key={item.itemId} venueId={venueId} item={item} />)}
        {queue.data.length > shown ? (
          <Stack align="start">
            <Button variant="secondary" onClick={() => setShown(shown + PAGE)}>
              {t('console.hostQueue.showMore', { count: formatNumber(Math.min(PAGE, queue.data.length - shown)) })}
            </Button>
          </Stack>
        ) : null}
      </Stack>
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
