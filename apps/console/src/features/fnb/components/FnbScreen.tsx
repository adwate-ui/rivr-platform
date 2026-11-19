import { useFnbOff, useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Inline, Screen, Stack, StatusMessage, Tabs, Text } from '@rivr/ui';
import { useState } from 'react';
import { MenuCsvPanel } from './MenuCsvImport.tsx';
import { MenuItems } from './MenuItems.tsx';
import { NewOrderSheet } from './NewOrderSheet.tsx';
import { OrdersTable } from './OrdersTable.tsx';

const TABS = ['orders', 'menu'] as const;
type FnbTab = (typeof TABS)[number];

/** What the staff member may do here: order for a seat, comp an order, and keep the menu's photos. */
interface FnbAccess {
  readonly venueId: string;
  /** Staff who serve order for a seat too (decision 0302), when they read who sits there: the floor, not Service alone (#640). */
  readonly canOrder: boolean;
  /** Staff who run F&B (fnb.manage): a comp and a dish's photo. */
  readonly canManage: boolean;
}

interface FnbScreenProps {
  /** The tab in the address, `?tab=menu`; the orders for any other. */
  tab: string | undefined;
  onNavigate: (href: string) => void;
}

/**
 * Food and drink (#123; console v3), for staff who run it (fnb.manage) or serve it (fnb.serve, Service's whole role, #640):
 * the day's orders as a table from the server (redesign RD-30), New order for a seat, and the
 * menu on its own tab, also from a CSV (#799). Glaza's monthly statement (#109) is hidden: no console shows money (#626).
 */
export function FnbScreen({ tab, onNavigate }: FnbScreenProps) {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { permissions, venueId } = staff.venue;
  if (!permissions.includes('fnb.manage') && !permissions.includes('fnb.serve')) {
    return <Screen title={t('console.fnb.title')} status="error" errorText={t('console.fnb.notAllowed')} />;
  }
  const canManage = permissions.includes('fnb.manage');
  const access: FnbAccess = { venueId, canManage, canOrder: canManage || (permissions.includes('fnb.serve') && permissions.includes('members.read')) };
  return <Fnb access={access} tab={TABS.find((one) => one === tab) ?? 'orders'} onNavigate={onNavigate} />;
}

/** New order, the screen's one gold action, and the sheet it opens, empty each time; then what was sent. */
function useNewOrder() {
  const [opened, setOpened] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [sentKot, setSentKot] = useState<number | null>(null);
  return {
    opened, isOpen, sentKot,
    open: () => { setOpened(opened + 1); setIsOpen(true); setSentKot(null); },
    close: () => setIsOpen(false),
    sent: (kot: number) => { setSentKot(kot); setIsOpen(false); },
  };
}

function Fnb({ access, tab, onNavigate }: { access: FnbAccess; tab: FnbTab; onNavigate: (href: string) => void }) {
  const newOrder = useNewOrder();
  // While a super admin has food and drink off, no new order; those still open are served here (decision 0681).
  const isFnbOff = useFnbOff(access.venueId);
  const canOrder = access.canOrder && !isFnbOff;
  const title = t('console.fnb.title');
  const action = canOrder ? <Button variant="primary" size="compact" onClick={newOrder.open}>{t('console.fnb.newOrder')}</Button> : undefined;
  const tabs = (
    <Tabs label={title} current={tab} onNavigate={onNavigate}
      tabs={TABS.map((id) => ({ id, label: t(`console.fnb.tabs.${id}`), href: `/fnb?tab=${id}` }))} />
  );
  // What was sent is said beside New order, where it was asked for, and takes no line above the lanes while empty.
  const sent = <StatusMessage>{newOrder.sentKot === null ? null : t('console.fnb.sent', { kot: newOrder.sentKot })}</StatusMessage>;
  return (
    <Screen title={title} actions={action === undefined ? undefined : <Inline gap={4} align="center" wrap>{sent}{action}</Inline>}>
      <Stack gap={6}>
        {isFnbOff ? <Text tone="muted">{t('console.fnb.off')}</Text> : null}
        {tabs}
        {tab === 'menu' ? <MenuTab access={access} /> : <OrdersTable venueId={access.venueId} />}
      </Stack>
      {canOrder ? (
        <NewOrderSheet key={newOrder.opened} venueId={access.venueId} isOpen={newOrder.isOpen} canComp={access.canManage}
          onClose={newOrder.close} onSent={newOrder.sent} />
      ) : null}
    </Screen>
  );
}

/** The menu by kind (#823); for staff who run F&B (redesign RD-33), a dish's photo (AS-11) and the menu from a CSV (#799), which opens in the panel. */
function MenuTab({ access }: { access: FnbAccess }) {
  return (
    <Stack gap={10}>
      <MenuItems venueId={access.venueId} canManage={access.canManage} />
      {access.canManage ? <MenuCsvPanel venueId={access.venueId} /> : null}
    </Stack>
  );
}
