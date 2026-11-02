import { useFloorSeats, useFloorTables, useStaffVenue } from '@rivr/db';
import { useFnbItems, useFnbMenu, useFnbOrdersTonight } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import type { ReactNode } from 'react';
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
  const canManage = permissions.includes('fnb.manage');
  // Staff who serve order for a seat too (decision 0302), when they read who sits there: the floor, not Service alone (#640).
  const canOrder = canManage || (permissions.includes('fnb.serve') && permissions.includes('members.read'));
  const sections = <FnbSections venueId={venueId} canOrder={canOrder} canManage={canManage} />;
  return canOrder ? <OrderingReady venueId={venueId}>{sections}</OrderingReady> : <ServingReady venueId={venueId}>{sections}</ServingReady>;
}

/**
 * The screen laid out once every list its sections read has come (UI polish audit E-07), so none pushes another down;
 * each role waits for, and reads, only what it is shown. Tonight's orders and the menu's items, for everyone here.
 */
function ServingReady({ venueId, children }: { venueId: string; children: ReactNode }) {
  const lists = [useFnbOrdersTonight(venueId), useFnbItems(venueId)];
  return lists.some((list) => list.isPending) ? <Screen title={t('console.fnb.title')} status="loading" /> : children;
}

/** For staff who run F&B, Ordering for a seat's floor and menu too, then the rest. */
function OrderingReady({ venueId, children }: { venueId: string; children: ReactNode }) {
  const lists = [useFnbMenu(venueId), useFloorSeats(venueId), useFloorTables()];
  if (lists.some((list) => list.isPending)) return <Screen title={t('console.fnb.title')} status="loading" />;
  return <ServingReady venueId={venueId}>{children}</ServingReady>;
}

function FnbSections({ venueId, canOrder, canManage }: { venueId: string; canOrder: boolean; canManage: boolean }) {
  return (
    <Screen title={t('console.fnb.title')}>
      <Stack gap={10}>
        <TonightOrders venueId={venueId} />
        {/* Ordering for a seat; a comp is for staff who run F&B alone (#640, decision 0302). */}
        {canOrder ? <OrderForSeat venueId={venueId} canComp={canManage} /> : null}
        {/* A dish's photo is for staff who run F&B: the photo bucket takes them alone (AS-11). */}
        <MenuItems venueId={venueId} canManage={canManage} />
      </Stack>
    </Screen>
  );
}
