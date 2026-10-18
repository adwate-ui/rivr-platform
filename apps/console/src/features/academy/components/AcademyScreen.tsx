import { useStaffAcademyBatches, useStaffAcademyBookings, useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, Text } from '@rivr/ui';
import { BatchPanel } from './BatchPanel.tsx';
import { NewBatchForm } from './NewBatchForm.tsx';

/** Academy, for Academy staff (`members.manage`) at the venue the console works in. */
export function AcademyScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('members.manage')) {
    return <Screen title={t('console.academy.title')} status="error" errorText={t('console.notAllowed')} />;
  }
  return <AcademyBatches venueId={staff.venue.venueId} />;
}

/** Opening a batch, then each batch with its bookings. */
function AcademyBatches({ venueId }: { venueId: string }) {
  const batches = useStaffAcademyBatches(venueId);
  const bookings = useStaffAcademyBookings(venueId);
  const title = t('console.academy.title');
  if (batches.isPending || bookings.isPending) return <Screen title={title} status="loading" />;
  if (batches.isError || bookings.isError) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([batches.refetch(), bookings.refetch()])} />;
  }
  return (
    <Screen title={title}>
      <Stack gap={10}>
        <NewBatchForm venueId={venueId} />
        {batches.data.length === 0 ? (
          <Text tone="muted">{t('console.academy.noBatches')}</Text>
        ) : (
          <Stack gap={8} divided>
            {batches.data.map((batch) => (
              <BatchPanel key={batch.id} venueId={venueId} batch={batch} bookings={bookings.data.filter((booking) => booking.batchId === batch.id)} />
            ))}
          </Stack>
        )}
      </Stack>
    </Screen>
  );
}
