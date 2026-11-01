import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { MenuItems } from './MenuItems.tsx';
import { OrderForSeat } from './OrderForSeat.tsx';
import { TonightOrders } from './TonightOrders.tsx';

/**
 * Food and drink (#123), for staff who run it (fnb.manage) or serve it (fnb.serve, Service's whole role, #640): serving tonight's
 * orders, the KOTs not yet at the bar and tonight's orders, ordering
 * for a seat (paid or comp) and Glaza's menu. Glaza's monthly statement (#109) is hidden: no console shows money (#626).
 */
export function FnbScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { permissions } = staff.venue;
  if (!permissions.includes('fnb.manage') && !permissions.includes('fnb.serve')) {
    return <Screen title={t('console.fnb.title')} status="error" errorText={t('console.fnb.notAllowed')} />;
  }
  const { venueId } = staff.venue;
  return (
    <Screen title={t('console.fnb.title')}>
      <Stack gap={10}>
        <TonightOrders venueId={venueId} />
        {/* Ordering for a seat can comp it: for staff who run F&B, never Service alone (#640). */}
        {permissions.includes('fnb.manage') ? <OrderForSeat venueId={venueId} /> : null}
        <MenuItems venueId={venueId} />
      </Stack>
    </Screen>
  );
}
