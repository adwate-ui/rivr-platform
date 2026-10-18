import { useFeature } from '@rivr/db';
import { useT } from '@rivr/i18n';
import { FeatureGate, Screen } from '@rivr/ui';

/** Session history, gated by tier (feature sessions.history). Lane C builds it out. */
export function SessionsScreen() {
  const t = useT();
  return (
    <FeatureGate access={useFeature('sessions.history')}>
      <Screen title={t('player.sessions.title')} status="empty" emptyText={t('player.sessions.empty')} />
    </FeatureGate>
  );
}
