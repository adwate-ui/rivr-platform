import { useFeature } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, Heading, Stack } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** The way to the events calendar (#143), for a member whose tier has events. */
export function EventsSection() {
  const navigate = useNavigate();
  const events = useFeature('events.book');
  if (events.state !== 'enabled') return null;
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.events.title')}</Heading>
      <Button variant="secondary" onClick={() => void navigate({ to: '/events' })}>{t('player.events.open')}</Button>
    </Stack>
  );
}
