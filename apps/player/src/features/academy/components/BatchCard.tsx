import { useAcademyActions, type AcademyBatch, type AcademyFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Money, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { BatchDates } from './BatchDates.tsx';
import { FAILURE_COPY } from './failureCopy.ts';

interface BatchCardProps {
  batch: AcademyBatch;
  /** Why the last booking of this batch was refused, said here while the card is listed. */
  failure: AcademyFailure | null;
  /** A booking is being tried: any earlier refusal no longer stands. */
  onBooking: () => void;
  /** The booking was refused; the screen keeps it, so it is still said once this card has gone. */
  onRefused: (failure: AcademyFailure) => void;
}

/** An open batch the member has no seat in: its dates, fee and seats left, and the way to book one. */
export function BatchCard({ batch, failure, onBooking, onRefused }: BatchCardProps) {
  const { book } = useAcademyActions();
  const navigate = useNavigate();
  const bookSeat = async () => {
    onBooking();
    const booked = await book.mutateAsync(batch.id);
    if (booked.ok) await navigate({ to: '/academy/$bookingId', params: { bookingId: booked.value } });
    else onRefused(booked.error);
  };
  const isFull = batch.seatsLeft === 0;
  return (
    <Stack gap={2}>
      <Heading level={3}>{batch.name}</Heading>
      <BatchDates startsOn={batch.startsOn} endsOn={batch.endsOn} />
      <Inline gap={3}>
        {batch.fee === null ? null : <Money paise={batch.fee} />}
        <Text tone="muted">{t('player.academy.seatsLeft', { seats: String(batch.seatsLeft) })}</Text>
      </Inline>
      {isFull ? (
        <Text>{t('player.academy.full')}</Text>
      ) : (
        <Button variant="primary" isLoading={book.isPending} onClick={() => void bookSeat()}>
          {t('player.academy.book')}
        </Button>
      )}
      {/* A refusal for a batch that has just filled is already said above. */}
      {failure !== null && !(failure === 'full' && isFull) ? <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage> : null}
    </Stack>
  );
}
