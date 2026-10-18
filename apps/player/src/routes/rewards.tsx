import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

function Rewards() {
  const t = useT();
  return <Screen title={t('player.rewards.title')} status="empty" emptyText={t('player.rewards.empty')} />;
}

/** Rewards: the tab always shows; the catalogue, League, referral and cab inside it are gated one by one. */
export const rewardsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/rewards', component: Rewards });
