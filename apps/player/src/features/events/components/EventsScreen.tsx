import { useFeatureStatus } from '@rivr/db';
import { useMyClubEvents } from '@rivr/db/clubEvents';
import { t } from '@rivr/i18n';
import { FeatureGate, LoadState, Screen, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';
import { EventCard } from './EventCard.tsx';

/** The club's events still to come, each bookable. The Academy's batches are hidden (#627). */
function EventList() {
  const events = useMyClubEvents();
  const [bookedTitle, setBookedTitle] = useState<string | null>(null);
  if (events.isPending) return <LoadState />;
  if (events.isError) return <LoadState isError errorText={t('player.events.failed')} onRetry={() => void events.refetch()} />;
  return (
    <Stack gap={6}>
      {events.data.length === 0 ? <Text tone="muted">{t('player.events.none')}</Text> : null}
      {events.data.map((event) => <EventCard key={event.eventId} event={event} onBooked={setBookedTitle} />)}
      <StatusMessage>{bookedTitle === null ? null : t('player.events.bookedAt', { title: bookedTitle })}</StatusMessage>
    </Stack>
  );
}

/**
 * The events calendar (#143; scope-v1 module 7): pro nights and corporate tables, booked here. Feature events.book.
 */
export function EventsScreen() {
  const feature = useFeatureStatus('events.book');
  const title = t('player.events.title');
  if (feature.status === 'loading') return <Screen title={title} status="loading" />;
  if (feature.status === 'error') return <Screen title={title} status="error" onRetry={feature.retry} />;
  return (
    <Screen title={title}>
      <FeatureGate access={feature.access}>
        <EventList />
      </FeatureGate>
    </Screen>
  );
}
