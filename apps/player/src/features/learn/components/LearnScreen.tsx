import { useFeature } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, FeatureGate, Heading, Screen, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

/**
 * Learn, gated by tier (feature learn.library): RIVR Academy batches to book (feature
 * academy.booking), then the library, which lane C builds out.
 */
export function LearnScreen() {
  const navigate = useNavigate();
  const academy = useFeature('academy.booking');
  return (
    <FeatureGate access={useFeature('learn.library')}>
      <Screen title={t('player.learn.title')}>
        <Stack gap={8}>
          <FeatureGate access={academy}>
            <Stack gap={3}>
              <Heading level={2}>{t('player.academy.title')}</Heading>
              <Text tone="muted">{t('player.academy.intro')}</Text>
              <Button variant="secondary" onClick={() => void navigate({ to: '/academy' })}>
                {t('player.academy.seeBatches')}
              </Button>
            </Stack>
          </FeatureGate>
          <Text tone="muted">{t('player.learn.empty')}</Text>
        </Stack>
      </Screen>
    </FeatureGate>
  );
}
