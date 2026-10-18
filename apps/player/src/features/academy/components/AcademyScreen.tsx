import { useAcademyBatches, useAcademyBookings, useFeature } from '@rivr/db';
import { t } from '@rivr/i18n';
import { FeatureGate, Heading, Screen, Stack } from '@rivr/ui';
import { BatchCard } from './BatchCard.tsx';
import { BookingCard } from './BookingCard.tsx';

/** RIVR Academy, for members whose tier has Academy booking (feature academy.booking). */
export function AcademyScreen() {
  return (
    <FeatureGate access={useFeature('academy.booking')}>
      <AcademyBatches />
    </FeatureGate>
  );
}

/** The member's own seats, then the open batches they have no seat in. */
function AcademyBatches() {
  const batches = useAcademyBatches();
  const bookings = useAcademyBookings();
  const title = t('player.academy.title');
  if (batches.isPending || bookings.isPending) return <Screen title={title} status="loading" />;
  if (batches.isError || bookings.isError) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([batches.refetch(), bookings.refetch()])} />;
  }
  const booked = new Set(bookings.data.map((booking) => booking.batchId));
  const open = batches.data.filter((batch) => !booked.has(batch.id));
  if (bookings.data.length === 0 && open.length === 0) return <Screen title={title} status="empty" emptyText={t('player.academy.empty')} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        {bookings.data.length > 0 ? (
          <Stack gap={4}>
            <Heading level={2}>{t('player.academy.yourBookings')}</Heading>
            <Stack gap={6} divided>
              {bookings.data.map((booking) => <BookingCard key={booking.id} booking={booking} />)}
            </Stack>
          </Stack>
        ) : null}
        {open.length > 0 ? (
          <Stack gap={4}>
            <Heading level={2}>{t('player.academy.openBatches')}</Heading>
            <Stack gap={6} divided>
              {open.map((batch) => <BatchCard key={batch.id} batch={batch} />)}
            </Stack>
          </Stack>
        ) : null}
      </Stack>
    </Screen>
  );
}
