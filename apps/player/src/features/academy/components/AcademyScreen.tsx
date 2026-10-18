import { useAcademyBatches, useAcademyBookings, useFeature } from '@rivr/db';
import { t } from '@rivr/i18n';
import { FeatureGate, Screen, Stack } from '@rivr/ui';
import { BatchCard } from './BatchCard.tsx';

/** RIVR Academy: the open batches, each with the member's booking or the way to book a seat. */
export function AcademyScreen() {
  const batches = useAcademyBatches();
  const bookings = useAcademyBookings();
  const title = t('player.academy.title');
  const access = useFeature('academy.booking');
  if (batches.isPending || bookings.isPending) return <Screen title={title} status="loading" />;
  if (batches.isError || bookings.isError) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([batches.refetch(), bookings.refetch()])} />;
  }
  if (batches.data.length === 0) return <Screen title={title} status="empty" emptyText={t('player.academy.empty')} />;
  return (
    <FeatureGate access={access}>
      <Screen title={title}>
        <Stack gap={8} divided>
          {batches.data.map((batch) => (
            <BatchCard key={batch.id} batch={batch} booking={bookings.data.find((booking) => booking.batchId === batch.id)} />
          ))}
        </Stack>
      </Screen>
    </FeatureGate>
  );
}
