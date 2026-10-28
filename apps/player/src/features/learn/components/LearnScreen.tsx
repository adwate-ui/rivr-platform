import { useFeature } from '@rivr/db';
import { useLearnLibrary } from '@rivr/db/learn';
import { t } from '@rivr/i18n';
import { Button, FeatureGate, Heading, LoadState, Screen, Stack, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

const LEVELS = ['one', 'two', 'three'] as const;

/** The licensed titles the member's tier has, each opening its hub. */
function LicensedTitles() {
  const navigate = useNavigate();
  const library = useLearnLibrary();
  if (library.isPending) return <LoadState />;
  if (library.isError) return <LoadState isError errorText={t('player.learn.failed')} onRetry={() => void library.refetch()} />;
  if (library.data.length === 0) return <Text tone="muted">{t('player.learn.noTitles')}</Text>;
  return (
    <Stack gap={3}>
      {library.data.map((source) => (
        <Stack key={source.sourceKey} gap={1}>
          <Button variant="secondary" onClick={() => void navigate({ to: '/learn/$sourceKey', params: { sourceKey: source.sourceKey } })}>{source.title}</Button>
          {source.author === null ? null : <Text variant="small" tone="muted">{t('player.learn.by', { author: source.author })}</Text>}
        </Stack>
      ))}
    </Stack>
  );
}

/**
 * Learn (#133), gated by tier (learn.library): RIVR Academy batches to book (academy.booking), the Academy's levels,
 * and the licensed titles the member's tier has, each opening its hub.
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
              <Button variant="secondary" onClick={() => void navigate({ to: '/academy' })}>{t('player.academy.seeBatches')}</Button>
            </Stack>
          </FeatureGate>
          <Stack gap={2}>
            <Heading level={2}>{t('player.learn.academy')}</Heading>
            {LEVELS.map((level) => <Text key={level}>{t(`player.learn.levels.${level}`)}</Text>)}
            <Text variant="small" tone="muted">{t('player.learn.levelsSoon')}</Text>
          </Stack>
          <Stack gap={3}>
            <Heading level={2}>{t('player.learn.licensed')}</Heading>
            <LicensedTitles />
          </Stack>
        </Stack>
      </Screen>
    </FeatureGate>
  );
}
