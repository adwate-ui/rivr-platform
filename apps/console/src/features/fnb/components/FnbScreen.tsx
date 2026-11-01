import { useFloorSeats, useFloorTables, useStaffVenue } from '@rivr/db';
import { useFnbItems, useFnbMenu, useFnbOrdersTonight } from '@rivr/db/fnb';
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
  return <FnbBody venueId={staff.venue.venueId} canOrder={permissions.includes('fnb.manage')} />;
}

/** The sections below, laid out once every list they read has come (UI polish audit E-07), so none pushes another down. */
function FnbBody({ venueId, canOrder }: { venueId: string; canOrder: boolean }) {
  // The sections read these too (one query each): Ordering for a seat reads the floor and the menu.
  const lists = [useFnbOrdersTonight(venueId), useFnbItems(venueId), useFnbMenu(venueId), useFloorSeats(venueId), useFloorTables()];
  if (lists.some((list) => list.isPending)) return <Screen title={t('console.fnb.title')} status="loading" />;
  return (
    <Screen title={t('console.fnb.title')}>
      <Stack gap={10}>
        <TonightOrders venueId={venueId} />
        {/* Ordering for a seat can comp it: for staff who run F&B, never Service alone (#640). */}
        {canOrder ? <OrderForSeat venueId={venueId} /> : null}
        <MenuItems venueId={venueId} />
      </Stack>
    </Screen>
  );
}
