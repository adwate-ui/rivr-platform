import { useT } from '@rivr/i18n';
import { Text } from '@rivr/ui';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Frame } from '../features/frame/index.ts';

function NotFound() {
  const t = useT();
  return <Text tone="muted">{t('common.notFound')}</Text>;
}

/** Every driver screen sits inside the frame. */
export const rootRoute = createRootRoute({
  component: () => (
    <Frame>
      <Outlet />
    </Frame>
  ),
  notFoundComponent: NotFound,
});
