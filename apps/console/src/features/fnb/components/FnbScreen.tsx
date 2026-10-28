import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { GlazaStatement } from './GlazaStatement.tsx';
import { MenuItems } from './MenuItems.tsx';
import { OrderForSeat } from './OrderForSeat.tsx';
import { TonightOrders } from './TonightOrders.tsx';

/**
 * Food and drink (#123), for staff who run it (fnb.manage): the KOTs not yet at the bar and tonight's orders, ordering
 * for a seat (paid or comp), Glaza's menu, and Glaza's monthly statement (#109).
 */
export function FnbScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('fnb.manage')) {
    return <Screen title={t('console.fnb.title')} status="error" errorText={t('console.fnb.notAllowed')} />;
  }
  const { venueId } = staff.venue;
  return (
    <Screen title={t('console.fnb.title')}>
      <Stack gap={10}>
        <TonightOrders venueId={venueId} />
        <OrderForSeat venueId={venueId} />
        <MenuItems venueId={venueId} />
        <GlazaStatement venueId={venueId} />
      </Stack>
    </Screen>
  );
}
