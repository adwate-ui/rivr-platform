import { useMyDevice } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { TableSeats } from './TableSeats.tsx';

/**
 * The table's seats, during a dealer's down (the frame asks for sign-in between downs): a seat tapped shows its call
 * time, marks the player away, back or gone, and orders food (#59). Hand entry, its rake and the buy-ins are off the
 * tablet (owner, 29 Oct, #630; decision 0284): no tablet shows money, and every workflow runs from the console without
 * it. HandForm and LastHands stay in this folder for when the club wants them back.
 */
export function HandEntryScreen() {
  const device = useMyDevice();
  const title = t('tablet.seats.screen');
  if ((device.data?.tableId ?? null) === null) return <Screen title={title} status="empty" emptyText={t('tablet.handEntry.empty')} />;
  return (
    <Screen title={title}>
      <TableSeats />
    </Screen>
  );
}
