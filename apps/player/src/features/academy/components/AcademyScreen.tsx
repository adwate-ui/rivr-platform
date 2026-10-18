import { useAcademyBatches, useAcademyBookings, useFeature, type AcademyBatch, type AcademyBooking, type AcademyFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ErrorMessage, FeatureGate, Heading, Screen, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { BatchCard } from './BatchCard.tsx';
import { BookingCard } from './BookingCard.tsx';
import { FAILURE_COPY } from './failureCopy.ts';

/** A booking the club refused, and for which batch. */
interface Refusal {
  readonly batchId: string;
  readonly batchName: string;
  readonly failure: AcademyFailure;
}

/** RIVR Academy, for members whose tier has Academy booking (feature academy.booking). */
export function AcademyScreen() {
  return (
    <FeatureGate access={useFeature('academy.booking')}>
      <AcademyBatches />
    </FeatureGate>
  );
}

/**
 * Why the last booking was refused, at the top of the screen with the batch's name: the batch may
 * have closed and left the list since, taking its card with it (#230). A batch that has just filled
 * says so on its own card, so that refusal is not said twice.
 */
function RefusalMessage({ refusal, open }: { refusal: Refusal | null; open: readonly AcademyBatch[] }) {
  if (refusal === null) return null;
  const saidOnCard = refusal.failure === 'full' && open.some((batch) => batch.id === refusal.batchId && batch.seatsLeft === 0);
  if (saidOnCard) return null;
  return <ErrorMessage>{t('player.academy.refused', { batch: refusal.batchName, reason: t(FAILURE_COPY[refusal.failure]) })}</ErrorMessage>;
}

/** The member's own seats, then the open batches they have no seat in. */
function AcademyBatches() {
  const batches = useAcademyBatches();
  const bookings = useAcademyBookings();
  const [refusal, setRefusal] = useState<Refusal | null>(null);
  const title = t('player.academy.title');
  if (batches.isPending || bookings.isPending) return <Screen title={title} status="loading" />;
  if (batches.isError || bookings.isError) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([batches.refetch(), bookings.refetch()])} />;
  }
  const booked = new Set(bookings.data.map((booking) => booking.batchId));
  const open = batches.data.filter((batch) => !booked.has(batch.id));
  const isEmpty = bookings.data.length === 0 && open.length === 0;
  if (isEmpty && refusal === null) return <Screen title={title} status="empty" emptyText={t('player.academy.empty')} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <RefusalMessage refusal={refusal} open={open} />
        {isEmpty ? <Text tone="muted">{t('player.academy.empty')}</Text> : null}
        <YourBookings bookings={bookings.data} />
        <OpenBatches open={open} onBooking={() => setRefusal(null)} onRefused={(batch, failure) => setRefusal({ batchId: batch.id, batchName: batch.name, failure })} />
      </Stack>
    </Screen>
  );
}

/** The member's own seats, or nothing when they have none. */
function YourBookings({ bookings }: { bookings: readonly AcademyBooking[] }) {
  if (bookings.length === 0) return null;
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('player.academy.yourBookings')}</Heading>
      <Stack gap={6} divided>
        {bookings.map((booking) => <BookingCard key={booking.id} booking={booking} />)}
      </Stack>
    </Stack>
  );
}

interface OpenBatchesProps {
  open: readonly AcademyBatch[];
  onBooking: () => void;
  onRefused: (batch: AcademyBatch, failure: AcademyFailure) => void;
}

/** The open batches the member has no seat in, or nothing when there are none. */
function OpenBatches({ open, onBooking, onRefused }: OpenBatchesProps) {
  if (open.length === 0) return null;
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('player.academy.openBatches')}</Heading>
      <Stack gap={6} divided>
        {open.map((batch) => (
          <BatchCard key={batch.id} batch={batch} onBooking={onBooking} onRefused={(failure) => onRefused(batch, failure)} />
        ))}
      </Stack>
    </Stack>
  );
}
