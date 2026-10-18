import { useT } from '@rivr/i18n';
import { Text } from '@rivr/ui';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

function Pickups() {
  const t = useT();
  return <Text tone="muted">{t('driver.pickups.empty')}</Text>;
}

/** The driver's pickups. Lane C builds the trip flow. */
export const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Pickups });
