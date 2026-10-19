import { useStaffVenue, useVenueDealers, type VenueDealer } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Screen, Stack, Text } from '@rivr/ui';
import { PinForm } from './PinForm.tsx';

/** Where a dealer's PIN stands: set, not yet, or locked after five wrong PINs and until when. */
function standing(dealer: VenueDealer): string {
  if (dealer.lockedUntil !== null) return t('console.dealerPins.locked', { time: formatTime(new Date(dealer.lockedUntil)) });
  return t(dealer.hasPin ? 'console.dealerPins.hasPin' : 'console.dealerPins.noPin');
}

/**
 * Dealer PINs (#41): the dealers whose PIN the signed-in manager may set, which a dealer then enters
 * on the tablet to start a down. Only staff whose role includes everything a dealer does set one
 * (decision 0046), so an admin sees the list empty.
 */
export function DealerPinsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('staff.manage')) {
    return <Screen title={t('console.dealerPins.title')} status="error" errorText={t('console.dealerPins.notAllowed')} />;
  }
  return <DealerList venueId={staff.venue.venueId} />;
}

function DealerList({ venueId }: { venueId: string }) {
  const dealers = useVenueDealers(venueId);
  const title = t('console.dealerPins.title');
  if (dealers.isPending) return <Screen title={title} status="loading" />;
  if (dealers.data === undefined) return <Screen title={title} status="error" onRetry={() => void dealers.refetch()} />;
  if (dealers.data.length === 0) return <Screen title={title} status="empty" emptyText={t('console.dealerPins.empty')} />;
  return (
    <Screen title={title}>
      <Stack gap={6} divided>
        {dealers.data.map((dealer) => (
          <Stack key={dealer.staffId} gap={3}>
            <Stack gap={1}>
              <Text weight="semibold">{dealer.fullName}</Text>
              <Text variant="small" tone="muted">{standing(dealer)}</Text>
            </Stack>
            <PinForm venueId={venueId} staffId={dealer.staffId} name={dealer.fullName} />
          </Stack>
        ))}
      </Stack>
    </Screen>
  );
}
