import type { AcademyBooking } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Heading, Money, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { BatchDates } from './BatchDates.tsx';
import { bookingStatus, holdLine } from './bookingStatus.ts';

/** One of the member's seats: its batch, what it costs, where it stands, and the way to pay or correct the UTR. */
export function BookingCard({ booking }: { booking: AcademyBooking }) {
  const navigate = useNavigate();
  const toPayment = () => void navigate({ to: '/academy/$bookingId', params: { bookingId: booking.id } });
  const hold = holdLine(booking, new Date());
  return (
    <Stack gap={2}>
      <Heading level={3}>{booking.batchName}</Heading>
      <BatchDates startsOn={booking.startsOn} endsOn={booking.endsOn} />
      <Money paise={booking.amount} />
      <Text>{bookingStatus(booking)}</Text>
      {hold === null ? null : <Text tone="muted">{hold}</Text>}
      {booking.status === 'awaiting_payment' ? (
        <Button variant="primary" onClick={toPayment}>
          {t('player.academy.pay')}
        </Button>
      ) : null}
      {booking.status === 'payment_claimed' ? (
        <Button variant="secondary" onClick={toPayment}>
          {t('player.academy.changeUtr')}
        </Button>
      ) : null}
    </Stack>
  );
}
