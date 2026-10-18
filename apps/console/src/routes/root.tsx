import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Frame } from '../features/frame/index.ts';

function NotFound() {
  const t = useT();
  return <Screen title={t('ui.brand.label')} status="error" errorText={t('common.notFound')} />;
}

/** Every console screen sits inside the frame: the rail and the kill-switch banner. */
export const rootRoute = createRootRoute({
  component: () => (
    <Frame>
      <Outlet />
    </Frame>
  ),
  notFoundComponent: NotFound,
});
