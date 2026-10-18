import { useAcademyActions, type AcademyBatch, type AcademyFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Heading, Inline, Money, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { BatchDates } from './BatchDates.tsx';
import { FAILURE_COPY } from './failureCopy.ts';

/** An open batch the member has no seat in: its dates, fee and seats left, and the way to book one. */
export function BatchCard({ batch }: { batch: AcademyBatch }) {
  const { book } = useAcademyActions();
  const navigate = useNavigate();
  const [failure, setFailure] = useState<AcademyFailure | null>(null);
  const bookSeat = async () => {
    const booked = await book.mutateAsync(batch.id);
    if (booked.ok) await navigate({ to: '/academy/$bookingId', params: { bookingId: booked.value } });
    else setFailure(booked.error);
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
      {failure !== null && !(failure === 'full' && isFull) ? <Text>{t(FAILURE_COPY[failure])}</Text> : null}
    </Stack>
  );
}
