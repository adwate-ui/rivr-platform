import { useFeature } from '@rivr/db';
import { useT } from '@rivr/i18n';
import { FeatureGate, Screen } from '@rivr/ui';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

function Learn() {
  const t = useT();
  return (
    <FeatureGate access={useFeature('learn.library')}>
      <Screen title={t('player.learn.title')} status="empty" emptyText={t('player.learn.empty')} />
    </FeatureGate>
  );
}

/** Learn, gated by tier (feature learn.library). */
export const learnRoute = createRoute({ getParentRoute: () => rootRoute, path: '/learn', component: Learn });
