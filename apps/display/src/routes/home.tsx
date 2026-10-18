import { useT } from '@rivr/i18n';
import { Text } from '@rivr/ui';
import { createRoute } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

function Unpaired() {
  const t = useT();
  return <Text variant="tvBody">{t('display.unpaired')}</Text>;
}

/** Before pairing, a TV says so. Lane B shows the six-digit pairing code and then the assigned mode. */
export const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: Unpaired });
