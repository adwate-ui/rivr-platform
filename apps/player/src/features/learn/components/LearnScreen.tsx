import { useFeature } from '@rivr/db';
import { t } from '@rivr/i18n';
import { FeatureGate, Screen } from '@rivr/ui';

/** Learn, gated by tier (feature learn.library). Lane C builds it out. */
export function LearnScreen() {
  return (
    <FeatureGate access={useFeature('learn.library')}>
      <Screen title={t('player.learn.title')} status="empty" emptyText={t('player.learn.empty')} />
    </FeatureGate>
  );
}
