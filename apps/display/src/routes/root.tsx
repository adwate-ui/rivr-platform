import { useT } from '@rivr/i18n';
import { Text } from '@rivr/ui';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Frame } from '../features/frame/index.ts';

function NotFound() {
  const t = useT();
  return <Text variant="tvBody">{t('common.notFound')}</Text>;
}

/** Every TV mode sits inside the frame. */
export const rootRoute = createRootRoute({
  component: () => (
    <Frame>
      <Outlet />
    </Frame>
  ),
  notFoundComponent: NotFound,
});
