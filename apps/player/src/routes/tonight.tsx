import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

function Tonight() {
  const t = useT();
  return <Screen title={t('player.tonight.title')} status="empty" emptyText={t('player.tonight.empty')} />;
}

/** Home: tonight's floor. Lane C builds it out. */
export const tonightRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Tonight });
