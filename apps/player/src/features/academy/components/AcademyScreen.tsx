import { useAcademyBatches, useAcademyBookings, useFeatureStatus, type AcademyBatch, type AcademyBooking, type AcademyFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { ErrorMessage, FeatureGate, Heading, Screen, Stack, Text, type FeatureAccess } from '@rivr/ui';
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

/**
 * RIVR Academy. Booking and paying need Academy booking (feature academy.booking), but a member's own
 * seats are a record of their money and always show (decision 0033, the owner's answer to #231).
 */
export function AcademyScreen() {
  const feature = useFeatureStatus('academy.booking');
  // Both views show the member's seats: read them alongside access, not after it.
  useAcademyBookings();
  const title = t('player.academy.title');
  // Until access is known: either view first would switch to the other once it is.
  if (feature.status === 'loading') return <Screen title={title} status="loading" />;
  if (feature.status === 'error') return <Screen title={title} status="error" onRetry={feature.retry} />;
  if (feature.access.state === 'enabled') return <AcademyBatches />;
  return <BookingsOnly access={feature.access} />;
}

/**
 * Without Academy booking: the member's own seats, to read only, and the locked notice where the open
 * batches would be. With no seats, only the notice, as before.
 */
function BookingsOnly({ access }: { access: FeatureAccess }) {
  const bookings = useAcademyBookings();
  const title = t('player.academy.title');
  if (bookings.isPending) return <Screen title={title} status="loading" />;
  if (bookings.isError) return <Screen title={title} status="error" onRetry={() => void bookings.refetch()} />;
  if (bookings.data.length === 0) return <FeatureGate access={access}>{null}</FeatureGate>;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <YourBookings bookings={bookings.data} canPay={false} />
        <FeatureGate access={access}>{null}</FeatureGate>
      </Stack>
    </Screen>
  );
}

// Refusals about the batch itself name it; the rest (the club paused, the account, the connection)
// are the same whatever the batch, and keep their own words.
const ABOUT_THE_BATCH: readonly AcademyFailure[] = ['full', 'closed'];

/**
 * Why the last booking was refused, at the top of the screen, once the batch has left the list and
 * taken its card with it (#230). While the batch is listed, its card says why, where the member tapped.
 */
function RefusalMessage({ refusal, open }: { refusal: Refusal | null; open: readonly AcademyBatch[] }) {
  if (refusal === null || open.some((batch) => batch.id === refusal.batchId)) return null;
  const reason = t(FAILURE_COPY[refusal.failure]);
  return <ErrorMessage>{ABOUT_THE_BATCH.includes(refusal.failure) ? t('player.academy.refused', { batch: refusal.batchName, reason }) : reason}</ErrorMessage>;
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
        <YourBookings bookings={bookings.data} canPay />
        <OpenBatches
          open={open}
          refusal={refusal}
          onBooking={() => setRefusal(null)}
          onRefused={(batch, failure) => setRefusal({ batchId: batch.id, batchName: batch.name, failure })}
        />
      </Stack>
    </Screen>
  );
}

/** The member's own seats, or nothing when they have none; with the way to pay only when they can. */
function YourBookings({ bookings, canPay }: { bookings: readonly AcademyBooking[]; canPay: boolean }) {
  if (bookings.length === 0) return null;
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('player.academy.yourBookings')}</Heading>
      <Stack gap={6} divided>
        {bookings.map((booking) => <BookingCard key={booking.id} booking={booking} canPay={canPay} />)}
      </Stack>
    </Stack>
  );
}

interface OpenBatchesProps {
  open: readonly AcademyBatch[];
  refusal: Refusal | null;
  onBooking: () => void;
  onRefused: (batch: AcademyBatch, failure: AcademyFailure) => void;
}

/** The open batches the member has no seat in, or nothing when there are none. */
function OpenBatches({ open, refusal, onBooking, onRefused }: OpenBatchesProps) {
  if (open.length === 0) return null;
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('player.academy.openBatches')}</Heading>
      <Stack gap={6} divided>
        {open.map((batch) => (
          <BatchCard
            key={batch.id}
            batch={batch}
            failure={refusal?.batchId === batch.id ? refusal.failure : null}
            onBooking={onBooking}
            onRefused={(failure) => onRefused(batch, failure)}
          />
        ))}
      </Stack>
    </Stack>
  );
}
