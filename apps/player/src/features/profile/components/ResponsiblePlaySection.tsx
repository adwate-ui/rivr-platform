import { t } from '@rivr/i18n';
import { Button, Heading, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/** The way to limits, cool-off and self-exclusion (#56). */
export function ResponsiblePlaySection() {
  const navigate = useNavigate();
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.profile.responsiblePlay')}</Heading>
      <Text tone="muted">{t('player.profile.responsiblePlayHint')}</Text>
      <Button variant="secondary" onClick={() => void navigate({ to: '/profile/limits' })}>
        {t('player.profile.limits')}
      </Button>
    </Stack>
  );
}
