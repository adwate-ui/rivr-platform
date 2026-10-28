import { useFeature } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, FeatureGate, Heading, Stack } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** The way to the events calendar (#143): the button with events.book, the locked notice where the tier shows it locked. */
export function EventsSection() {
  const navigate = useNavigate();
  const events = useFeature('events.book');
  return (
    <FeatureGate access={events}>
      <Stack gap={3}>
        <Heading level={2}>{t('player.events.title')}</Heading>
        <Button variant="secondary" onClick={() => void navigate({ to: '/events' })}>{t('player.events.open')}</Button>
      </Stack>
    </FeatureGate>
  );
}
