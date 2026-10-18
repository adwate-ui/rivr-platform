import { useAcademyBookings, useAcademyPayment, useFeature, type AcademyPayment } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, FeatureGate, Money, Screen, Stack, Text } from '@rivr/ui';
import { useNavigate, useParams } from '@tanstack/react-router';
import { bookingStatus, holdLine } from './bookingStatus.ts';
import { UtrForm } from './UtrForm.tsx';

/** Paying for a seat, for members whose tier has Academy booking (feature academy.booking). */
export function AcademyPaymentScreen() {
  return (
    <FeatureGate access={useFeature('academy.booking')}>
      <Payment />
    </FeatureGate>
  );
}

/** The amount and the club's UPI ID, paid from any UPI app, then the UTR of that payment. */
function PayDetails({ payment, bookingId }: { payment: AcademyPayment; bookingId: string }) {
  if (payment.upiVpa === null) return <Text>{t('player.academy.noUpi')}</Text>;
  return (
    <Stack gap={6}>
      <Stack gap={1}>
        <Text variant="small" tone="muted">{t('player.academy.amount')}</Text>
        <Money paise={payment.amount} />
      </Stack>
      <Stack gap={1}>
        <Text variant="small" tone="muted">{t('player.academy.upiId')}</Text>
        <Text weight="medium">{payment.upiVpa}</Text>
        {payment.upiPayeeName === null ? null : <Text tone="muted">{payment.upiPayeeName}</Text>}
      </Stack>
      <Text>{t('player.academy.payHow')}</Text>
      <UtrForm bookingId={bookingId} />
    </Stack>
  );
}

/**
 * One of the member's seats: where it stands, then while it is unpaid what to pay and where, and the
 * UTR. A cashier confirms the UTR against the bank.
 */
function Payment() {
  const { bookingId = '' } = useParams({ strict: false });
  const bookings = useAcademyBookings();
  const payment = useAcademyPayment(bookingId);
  const navigate = useNavigate();
  const title = t('player.academy.payTitle');
  const back = (
    <Button variant="text" onClick={() => void navigate({ to: '/academy' })}>
      {t('common.back')}
    </Button>
  );
  if (bookings.isPending || payment.isPending) return <Screen title={title} status="loading" />;
  if (bookings.isError || payment.isError) {
    return <Screen title={title} status="error" onRetry={() => void Promise.all([bookings.refetch(), payment.refetch()])} />;
  }
  const booking = bookings.data.find((candidate) => candidate.id === bookingId);
  if (!booking) return <Screen title={title} actions={back} status="empty" emptyText={t('player.academy.bookingGone')} />;
  const hold = holdLine(booking, new Date());
  return (
    <Screen title={title} actions={back}>
      <Stack gap={6}>
        <Stack gap={1}>
          <Text>{bookingStatus(booking)}</Text>
          {hold === null ? null : <Text tone="muted">{hold}</Text>}
        </Stack>
        {booking.status !== 'paid' && payment.data ? <PayDetails payment={payment.data} bookingId={booking.id} /> : null}
      </Stack>
    </Screen>
  );
}
