import { useHighHands, useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Heading, Screen, Stack } from '@rivr/ui';
import { ClaimRow } from './ClaimRow.tsx';
import { HistoryRow } from './HistoryRow.tsx';

/**
 * High hands (#47; flow 6): claims from the tablets waiting for the floor, which staff who approve
 * jackpots pay or reject, and the history. Staff who read the ledger see it too.
 */
export function HighHandsSection() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { permissions, venueId } = staff.venue;
  if (!permissions.includes('jackpots.approve') && !permissions.includes('ledger.read')) {
    return <Screen level={2} title={t('console.highHands.title')} status="error" errorText={t('console.highHands.notAllowed')} />;
  }
  return <HighHandList venueId={venueId} canDecide={permissions.includes('jackpots.approve')} />;
}

function HighHandList({ venueId, canDecide }: { venueId: string; canDecide: boolean }) {
  const hands = useHighHands(venueId);
  const title = t('console.highHands.title');
  if (hands.isPending) return <Screen level={2} title={title} status="loading" />;
  // A failed refresh keeps what was known, so a reason half typed stays put.
  if (hands.data === undefined) return <Screen level={2} title={title} status="error" onRetry={() => void hands.refetch()} />;
  if (hands.data.length === 0) return <Screen level={2} title={title} status="empty" emptyText={t('console.highHands.empty')} />;
  const waiting = hands.data.filter((hand) => hand.status === 'claimed');
  const decided = hands.data.filter((hand) => hand.status !== 'claimed');
  return (
    <Screen level={2} title={title}>
      <Stack gap={8}>
        {waiting.length === 0 ? null : (
          <Stack gap={4}>
            <Heading level={2}>{t('console.highHands.waiting')}</Heading>
            <Stack gap={4} divided>
              {waiting.map((hand) => <ClaimRow key={hand.claimId} venueId={venueId} hand={hand} canDecide={canDecide} />)}
            </Stack>
          </Stack>
        )}
        {decided.length === 0 ? null : (
          <Stack gap={4}>
            <Heading level={2}>{t('console.highHands.history')}</Heading>
            <Stack gap={3} divided>
              {decided.map((hand) => <HistoryRow key={hand.claimId} venueId={venueId} hand={hand} canDecide={canDecide} />)}
            </Stack>
          </Stack>
        )}
      </Stack>
    </Screen>
  );
}
