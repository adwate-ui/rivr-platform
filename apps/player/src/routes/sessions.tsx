import { useFeature } from '@rivr/db';
import { useT } from '@rivr/i18n';
import { FeatureGate, Screen } from '@rivr/ui';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

function Sessions() {
  const t = useT();
  return (
    <FeatureGate access={useFeature('sessions.history')}>
      <Screen title={t('player.sessions.title')} status="empty" emptyText={t('player.sessions.empty')} />
    </FeatureGate>
  );
}

/** Session history, gated by tier (feature sessions.history). */
export const sessionsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/sessions', component: Sessions });
