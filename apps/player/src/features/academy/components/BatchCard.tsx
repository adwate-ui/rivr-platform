import { useAcademyActions, type AcademyBatch, type AcademyBooking, type AcademyFailure } from '@rivr/db';
import { formatDate, t, type MessageKey } from '@rivr/i18n';
import { Button, Heading, Inline, Money, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { FAILURE_COPY } from './failureCopy.ts';

const STATUS_COPY: Readonly<Record<AcademyBooking['status'], MessageKey>> = {
  awaiting_payment: 'player.academy.awaitingPayment',
  payment_claimed: 'player.academy.paymentSent',
  paid: 'player.academy.paid',
  cancelled: 'player.academy.cancelled',
};

/** An ISO day as noon UTC, so it formats as the same day in India. */
function day(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

/** The member's booking on a batch: where it stands, and the way to pay while it is unpaid. */
function BookingStatus({ booking }: { booking: AcademyBooking }) {
  const navigate = useNavigate();
  return (
    <Stack gap={2}>
      <Text>{t(STATUS_COPY[booking.status])}</Text>
      {booking.status === 'awaiting_payment' || booking.status === 'payment_claimed' ? (
        <Button variant={booking.status === 'awaiting_payment' ? 'primary' : 'secondary'}
          onClick={() => void navigate({ to: '/academy/$bookingId', params: { bookingId: booking.id } })}>
          {t(booking.status === 'awaiting_payment' ? 'player.academy.pay' : 'player.academy.changeUtr')}
        </Button>
      ) : null}
    </Stack>
  );
}

/** One open batch: its dates, fee and seats left, and the member's booking or the way to book. */
export function BatchCard({ batch, booking }: { batch: AcademyBatch; booking: AcademyBooking | undefined }) {
  const { book } = useAcademyActions();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<AcademyFailure | null>(null);
  const bookSeat = async () => {
    const booked = await book.mutateAsync(batch.id);
    if (booked.ok) await navigate({ to: '/academy/$bookingId', params: { bookingId: booked.value } });
    else setFailure(booked.error);
  };
  return (
    <Stack gap={2}>
      <Heading level={2}>{batch.name}</Heading>
      <Text tone="muted">{t('player.academy.dates', { from: formatDate(day(batch.startsOn)), to: formatDate(day(batch.endsOn)) })}</Text>
      <Inline gap={3}>
        {batch.fee === null ? null : <Money paise={batch.fee} />}
        <Text tone="muted">{t('player.academy.seatsLeft', { seats: String(batch.seatsLeft) })}</Text>
      </Inline>
      {booking ? <BookingStatus booking={booking} /> : null}
      {!booking && batch.seatsLeft > 0 ? (
        <Button variant="primary" isLoading={book.isPending} onClick={() => void bookSeat()}>
          {t('player.academy.book')}
        </Button>
      ) : null}
      {!booking && batch.seatsLeft === 0 ? <Text>{t('player.academy.full')}</Text> : null}
      {failure ? <Text>{t(FAILURE_COPY[failure])}</Text> : null}
    </Stack>
  );
}
