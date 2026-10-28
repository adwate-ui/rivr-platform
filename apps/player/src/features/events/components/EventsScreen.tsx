import { useAcademyBatches, useFeatureStatus } from '@rivr/db';
import { useMyClubEvents } from '@rivr/db/clubEvents';
import { formatDate, t } from '@rivr/i18n';
import { Button, FeatureGate, Heading, LoadState, Screen, Stack, StatusMessage, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { EventCard } from './EventCard.tsx';

/** The Academy's open batches, booked on the Academy's own screen. */
function AcademyBatches() {
  const navigate = useNavigate();
  const batches = useAcademyBatches();
  const open = batches.data ?? [];
  if (open.length === 0) return null;
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.events.academy')}</Heading>
      {open.map((batch) => (
        <Text key={batch.id}>{t('player.events.academyLine', {
          name: batch.name, from: formatDate(new Date(batch.startsOn)), to: formatDate(new Date(batch.endsOn)),
        })}</Text>
      ))}
      <Button variant="secondary" onClick={() => void navigate({ to: '/academy' })}>{t('player.events.academyBook')}</Button>
    </Stack>
  );
}

/** The club's events still to come, each bookable, then the Academy's batches. */
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
      <AcademyBatches />
    </Stack>
  );
}

/**
 * The events calendar (#143; scope-v1 module 7): pro nights and corporate tables, booked here, and the Academy's
 * batches, booked at the Academy. Feature events.book.
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
