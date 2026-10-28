import { useBookClubEvent, type ClubEventFailure, type MyClubEvent } from '@rivr/db/clubEvents';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** One event: its title, kind and time, any details, the seats left, and booking or giving back a seat. */
export function EventCard({ event, onBooked }: { event: MyClubEvent; onBooked: (title: string | null) => void }) {
  const book = useBookClubEvent();
  const [failure, setFailure] = useState<ClubEventFailure | null>(null);
  const change = (isBooking: boolean) => void book.mutateAsync({ eventId: event.eventId, isBooking }).then((done) => {
    setFailure(done.ok ? null : done.error);
    if (done.ok) onBooked(isBooking ? event.title : null);
  });
  return (
    <Stack gap={2}>
      <Text weight="medium">{event.title}</Text>
      <Text variant="small" tone="muted">
        {t('player.events.line', { kind: t(`player.events.kinds.${event.kind}`), when: formatDayTime(new Date(event.startsAt)) })}
      </Text>
      {event.details === null ? null : <Text variant="small">{event.details}</Text>}
      {event.isBooked ? <Text variant="small">{t('player.events.booked')}</Text>
        : <Text variant="small" tone="muted">{event.seatsLeft > 0 ? t('player.events.seatsLeft', { count: event.seatsLeft }) : t('player.events.full')}</Text>}
      <Inline>
        {event.isBooked
          ? <Button variant="text" isLoading={book.isPending} aria-label={t('player.events.giveBackName', { title: event.title })} onClick={() => change(false)}>
              {t('player.events.giveBack')}
            </Button>
          : <Button variant="secondary" isDisabled={event.seatsLeft <= 0} isLoading={book.isPending}
              aria-label={t('player.events.bookName', { title: event.title })} onClick={() => change(true)}>{t('player.events.book')}</Button>}
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(`player.events.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}
