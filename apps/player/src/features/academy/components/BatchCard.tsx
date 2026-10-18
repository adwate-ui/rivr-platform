import { useAcademyActions, type AcademyBatch, type AcademyFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Heading, Inline, Money, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { BatchDates } from './BatchDates.tsx';

interface BatchCardProps {
  batch: AcademyBatch;
  /** A booking is being tried: any earlier refusal no longer stands. */
  onBooking: () => void;
  /** The booking was refused; the screen says why, by name, even once this card has gone. */
  onRefused: (failure: AcademyFailure) => void;
}

/** An open batch the member has no seat in: its dates, fee and seats left, and the way to book one. */
export function BatchCard({ batch, onBooking, onRefused }: BatchCardProps) {
  const { book } = useAcademyActions();
  const navigate = useNavigate();
  const bookSeat = async () => {
    onBooking();
    const booked = await book.mutateAsync(batch.id);
    if (booked.ok) await navigate({ to: '/academy/$bookingId', params: { bookingId: booked.value } });
    else onRefused(booked.error);
  };
  return (
    <Stack gap={2}>
      <Heading level={3}>{batch.name}</Heading>
      <BatchDates startsOn={batch.startsOn} endsOn={batch.endsOn} />
      <Inline gap={3}>
        {batch.fee === null ? null : <Money paise={batch.fee} />}
        <Text tone="muted">{t('player.academy.seatsLeft', { seats: String(batch.seatsLeft) })}</Text>
      </Inline>
      {batch.seatsLeft === 0 ? (
        <Text>{t('player.academy.full')}</Text>
      ) : (
        <Button variant="primary" isLoading={book.isPending} onClick={() => void bookSeat()}>
          {t('player.academy.book')}
        </Button>
      )}
    </Stack>
  );
}
