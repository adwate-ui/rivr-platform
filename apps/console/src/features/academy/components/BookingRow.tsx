import { useStaffAcademyActions, type AcademyStaffFailure, type StaffAcademyBooking } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Money, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { bookingFor, bookingStatus } from './bookingText.ts';
import { FAILURE_COPY } from './failureCopy.ts';
import { RecordUtr } from './RecordUtr.tsx';

/** One booking on a batch: who for, what it costs, where it stands; while unpaid, recording a UTR or cancelling. */
export function BookingRow({ venueId, booking }: { venueId: string; booking: StaffAcademyBooking }) {
  const { cancelBooking, markPresent, graduate } = useStaffAcademyActions(venueId);
  const [failure, setFailure] = useState<AcademyStaffFailure | null>(null);
  const cancel = async () => {
    const cancelled = await cancelBooking.mutateAsync(booking.id);
    setFailure(cancelled.ok ? null : cancelled.error);
  };
  const step = async (run: Promise<{ ok: true } | { ok: false; error: AcademyStaffFailure }>) => {
    const done = await run;
    setFailure(done.ok ? null : done.error);
  };
  const payer = bookingFor(booking);
  return (
    <Stack gap={2}>
      <Inline gap={4} justify="between">
        <Text weight="medium">{payer}</Text>
        <Money paise={booking.amount} />
      </Inline>
      <Text tone="muted">{bookingStatus(booking)}</Text>
      {booking.status === 'awaiting_payment' ? (
        <Inline gap={4} align="end" wrap>
          <RecordUtr venueId={venueId} bookingId={booking.id} payer={payer} />
          <Button variant="secondary" isLoading={cancelBooking.isPending} onClick={() => void cancel()}>
            {t('console.academy.cancel')}
          </Button>
        </Inline>
      ) : null}
      {booking.companyName === null && booking.status !== 'awaiting_payment' ? <Student booking={booking}
        onPresent={() => void step(markPresent.mutateAsync(booking.id))} onGraduate={() => void step(graduate.mutateAsync(booking.id))}
        isBusy={markPresent.isPending || graduate.isPending} /> : null}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}

/** A student's classes and graduation (#128): Present today at each class, and Graduate once. */
function Student({ booking, onPresent, onGraduate, isBusy }: { booking: StaffAcademyBooking; onPresent: () => void; onGraduate: () => void; isBusy: boolean }) {
  const attended = booking.classesAttended === 1 ? t('console.academy.attendedOne') : t('console.academy.attended', { count: booking.classesAttended });
  return (
    <Inline gap={4} align="center" wrap>
      <Text variant="small" tone="muted">{attended}</Text>
      {booking.graduatedAt === null ? (
        <>
          <Button variant="secondary" isDisabled={isBusy} onClick={onPresent}>{t('console.academy.markPresent')}</Button>
          <Button variant="secondary" isDisabled={isBusy} onClick={onGraduate}>{t('console.academy.graduate')}</Button>
        </>
      ) : <Text variant="small">{t('console.academy.graduated')}</Text>}
    </Inline>
  );
}
