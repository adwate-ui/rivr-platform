import { useStaffVenue, useVenueDealers, type VenueDealer } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, DataTable, Screen, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';
import { PinForm } from './PinForm.tsx';

/** Where a dealer's PIN stands: set, not yet, or locked after five wrong PINs and until when. */
function standing(dealer: VenueDealer): string {
  if (dealer.lockedUntil !== null) return t('console.dealerPins.locked', { time: formatTime(new Date(dealer.lockedUntil)) });
  return t(dealer.hasPin ? 'console.dealerPins.hasPin' : 'console.dealerPins.noPin');
}

/** The columns: the dealer, where their PIN stands, and Set PIN or Change, which opens the PIN's field under the row. */
function pinColumns(openId: string | null, onOpen: (dealer: VenueDealer) => void): readonly DataTableColumn<VenueDealer>[] {
  return [
    { key: 'dealer', header: t('console.dealerPins.dealer'), cell: (dealer) => dealer.fullName, sortValue: (dealer) => dealer.fullName, priority: 'primary' },
    { key: 'pin', header: t('console.dealerPins.pinColumn'), cell: standing },
    {
      key: 'set', header: '', align: 'end',
      cell: (dealer) => (
        <Button variant="subtle" size="small" aria-label={t(dealer.hasPin ? 'console.dealerPins.changeFor' : 'console.dealerPins.setFor', { name: dealer.fullName })}
          aria-expanded={openId === dealer.staffId} onClick={() => onOpen(dealer)}>
          {dealer.hasPin ? t('console.dealerPins.change') : t('console.dealerPins.set')}
        </Button>
      ),
    },
  ];
}

/**
 * Dealer PINs (#41, console v3): a table of the dealers whose PIN the signed-in manager may set, each with Set PIN in its
 * row, which opens the PIN's field under it, rather than a form for every dealer. A dealer then enters it on the tablet
 * to start a down. Only staff whose role includes everything a dealer does set one (decision 0046), so an admin sees the
 * list empty.
 */
export function DealerPinsSection() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('staff.manage')) {
    return <Screen level={2} title={t('console.dealerPins.title')} status="error" errorText={t('console.dealerPins.notAllowed')} />;
  }
  return <DealerList venueId={staff.venue.venueId} />;
}

function DealerList({ venueId }: { venueId: string }) {
  const dealers = useVenueDealers(venueId);
  const [openId, setOpenId] = useState<string | null>(null);
  const title = t('console.dealerPins.title');
  if (dealers.isPending) return <Screen level={2} title={title} status="loading" loadingLook="rows" />;
  if (dealers.data === undefined) return <Screen level={2} title={title} status="error" onRetry={() => void dealers.refetch()} />;
  if (dealers.data.length === 0) return <Screen level={2} title={title} status="empty" emptyText={t('console.dealerPins.empty')} />;
  return (
    <Screen level={2} title={title}>
      <DataTable label={title} columns={pinColumns(openId, (dealer) => setOpenId(openId === dealer.staffId ? null : dealer.staffId))} rows={dealers.data}
        rowKey={(dealer) => dealer.staffId} emptyText={t('console.dealerPins.empty')}
        rowDetail={(dealer) => (openId === dealer.staffId ? <PinForm venueId={venueId} staffId={dealer.staffId} name={dealer.fullName} /> : null)} />
    </Screen>
  );
}
