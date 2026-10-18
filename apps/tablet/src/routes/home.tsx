import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

function HandEntry() {
  const t = useT();
  return <Screen title={t('tablet.handEntry.title')} status="empty" emptyText={t('tablet.handEntry.empty')} />;
}

/** Hand entry: the seat ring, the pot keypad and Log hand. Lane B builds it out. */
export const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: HandEntry });
