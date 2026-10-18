import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

function Balance() {
  const t = useT();
  return <Screen title={t('player.balance.title')} status="empty" emptyText={t('player.balance.empty')} />;
}

/** Balance is a core feature: never gated, so a member always sees their own money. */
export const balanceRoute = createRoute({ getParentRoute: () => rootRoute, path: '/balance', component: Balance });
