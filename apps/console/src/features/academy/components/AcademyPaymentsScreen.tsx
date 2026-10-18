import { useStaffAcademyBatches, useStaffAcademyBookings, useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { PaymentRow } from './PaymentRow.tsx';

/** Academy payments, for the cage (`cage.transact`) at the venue the console works in. */
export function AcademyPaymentsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('cage.transact')) {
    return <Screen title={t('console.academyPayments.title')} status="error" errorText={t('console.notAllowed')} />;
  }
  return <PaymentsToCheck venueId={staff.venue.venueId} />;
}

/** Every UTR a payer gave, oldest first, for the cashier to find in the bank. */
function PaymentsToCheck({ venueId }: { venueId: string }) {
  const batches = useStaffAcademyBatches(venueId);
  const bookings = useStaffAcademyBookings(venueId);
  const title = t('console.academyPayments.title');
  if (batches.isPending || bookings.isPending) return <Screen title={title} status="loading" />;
  if (batches.isError || bookings.isError) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([batches.refetch(), bookings.refetch()])} />;
  }
  const toCheck = bookings.data.filter((booking) => booking.status === 'payment_claimed');
  if (toCheck.length === 0) return <Screen title={title} status="empty" emptyText={t('console.academyPayments.empty')} />;
  const batchName = (batchId: string) => batches.data.find((batch) => batch.id === batchId)?.name ?? '';
  return (
    <Screen title={title}>
      <Stack gap={6} divided>
        {toCheck.map((booking) => <PaymentRow key={booking.id} venueId={venueId} booking={booking} batchName={batchName(booking.batchId)} />)}
      </Stack>
    </Screen>
  );
}
