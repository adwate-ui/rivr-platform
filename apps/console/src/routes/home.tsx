import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

function LiveFloor() {
  const t = useT();
  return <Screen title={t('console.liveFloor.title')} status="empty" emptyText={t('console.liveFloor.empty')} />;
}

/** Live floor: the room plan, tables, rake and hands per hour. Lane B builds it out. */
export const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LiveFloor });
