import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

function Profile() {
  const t = useT();
  return <Screen title={t('player.profile.title')} status="empty" emptyText={t('player.profile.empty')} />;
}

/** Profile, behind the member's initial. Lane C adds sign-in. */
export const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/profile', component: Profile });
