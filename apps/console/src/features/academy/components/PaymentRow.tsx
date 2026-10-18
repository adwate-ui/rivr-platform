import { useStaffAcademyActions, type AcademyStaffFailure, type StaffAcademyBooking } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Inline, Money, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { bookingFor } from './bookingText.ts';
import { FAILURE_COPY } from './failureCopy.ts';

/**
 * One payment to check: who paid, for which batch, how much, and the UTR to find in the bank. Found,
 * it is confirmed into the ledger; not found, the claim is undone and the payer told. Either way the
 * UTR sent is the one the cashier looked for, so a UTR changed meanwhile is never acted on.
 */
export function PaymentRow({ venueId, booking, batchName }: { venueId: string; booking: StaffAcademyBooking; batchName: string }) {
  const { confirmPayment, rejectPayment } = useStaffAcademyActions(venueId);
  const [failure, setFailure] = useState<AcademyStaffFailure | null>(null);
  const settle = async (step: typeof confirmPayment) => {
    const settled = await step.mutateAsync({ bookingId: booking.id, utr: booking.utr ?? '' });
    setFailure(settled.ok ? null : settled.error);
  };
  return (
    <Stack gap={2}>
      <Inline gap={4} justify="between">
        <Text weight="medium">{bookingFor(booking)}</Text>
        <Money paise={booking.amount} />
      </Inline>
      <Text tone="muted">{batchName}</Text>
      <Text>{t('console.academyPayments.payment', { utr: booking.utr ?? '' })}</Text>
      <Inline gap={3}>
        <Button variant="primary" isLoading={confirmPayment.isPending} onClick={() => void settle(confirmPayment)}>
          {t('console.academyPayments.found')}
        </Button>
        <Button variant="secondary" isLoading={rejectPayment.isPending} onClick={() => void settle(rejectPayment)}>
          {t('console.academyPayments.notFound')}
        </Button>
      </Inline>
      {failure === null ? null : <Text>{t(FAILURE_COPY[failure])}</Text>}
    </Stack>
  );
}
