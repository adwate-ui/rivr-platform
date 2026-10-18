import { useStaffAcademyActions, type AcademyStaffFailure, type StaffAcademyBooking } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Money, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { bookingFor } from './bookingText.ts';
import { FAILURE_COPY } from './failureCopy.ts';

interface PaymentRowProps {
  venueId: string;
  /** The signed-in cashier's staff record at this venue. */
  staffId: string;
  booking: StaffAcademyBooking;
  batchName: string;
}

/**
 * One payment to check: who paid, for which batch, how much, and the UTR to find in the bank. Found,
 * it is confirmed into the ledger; not found, the claim is undone and the payer told. The UTR sent is
 * the one this row first showed: if the payer changes it meanwhile, the row says so and the cashier
 * looks for the new one before anything is confirmed.
 */
export function PaymentRow({ venueId, staffId, booking, batchName }: PaymentRowProps) {
  const [seenUtr, setSeenUtr] = useState(booking.utr ?? '');
  const hasChanged = booking.utr !== null && booking.utr !== seenUtr;
  return (
    <Stack gap={2}>
      <Inline gap={4} justify="between">
        <Text weight="medium">{bookingFor(booking)}</Text>
        <Money paise={booking.amount} />
      </Inline>
      <Text tone="muted">{batchName}</Text>
      <Text>{t('console.academyPayments.payment', { utr: seenUtr })}</Text>
      {hasChanged ? (
        <Stack gap={2}>
          <ErrorMessage>{t('console.academyPayments.changed', { utr: booking.utr ?? '' })}</ErrorMessage>
          <Button variant="secondary" onClick={() => setSeenUtr(booking.utr ?? '')}>
            {t('console.academyPayments.checkNew')}
          </Button>
        </Stack>
      ) : (
        <PaymentActions venueId={venueId} bookingId={booking.id} utr={seenUtr} isRecordedByYou={booking.recordedByStaffId === staffId} />
      )}
    </Stack>
  );
}

/** Found or not found in the bank, for the UTR the cashier looked for. Never confirmed by whoever recorded it. */
function PaymentActions({ venueId, bookingId, utr, isRecordedByYou }: { venueId: string; bookingId: string; utr: string; isRecordedByYou: boolean }) {
  const { confirmPayment, rejectPayment } = useStaffAcademyActions(venueId);
  const [failure, setFailure] = useState<AcademyStaffFailure | null>(null);
  const settle = async (step: typeof confirmPayment) => {
    const settled = await step.mutateAsync({ bookingId, utr });
    // A UTR changed meanwhile comes back with the reload, and the row says so itself.
    setFailure(settled.ok || settled.error === 'utr_mismatch' ? null : settled.error);
  };
  return (
    <Stack gap={2}>
      <Inline gap={3}>
        {isRecordedByYou ? null : (
          <Button variant="secondary" isLoading={confirmPayment.isPending} onClick={() => void settle(confirmPayment)}>
            {t('console.academyPayments.found')}
          </Button>
        )}
        <Button variant="secondary" isLoading={rejectPayment.isPending} onClick={() => void settle(rejectPayment)}>
          {t('console.academyPayments.notFound')}
        </Button>
      </Inline>
      {isRecordedByYou ? <Text tone="muted">{t('console.academyPayments.recordedByYou')}</Text> : null}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
