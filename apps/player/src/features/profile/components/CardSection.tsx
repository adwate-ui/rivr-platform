import { t } from '@rivr/i18n';
import { Button, Heading, Stack } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** The way to the membership card (#71), which the door scans; every member has one. */
export function CardSection() {
  const navigate = useNavigate();
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.profile.card')}</Heading>
      <Button variant="secondary" onClick={() => void navigate({ to: '/card' })}>
        {t('player.profile.showCard')}
      </Button>
    </Stack>
  );
}
