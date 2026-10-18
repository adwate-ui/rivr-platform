import { useT } from '@rivr/i18n';
import { Screen } from '@rivr/ui';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Frame } from '../features/frame/index.ts';

function NotFound() {
  const t = useT();
  return <Screen title={t('tablet.handEntry.title')} status="error" errorText={t('common.notFound')} />;
}

/** Every tablet screen sits inside the frame: the table name and the kill-switch banner. */
export const rootRoute = createRootRoute({
  component: () => (
    <Frame>
      <Outlet />
    </Frame>
  ),
  notFoundComponent: NotFound,
});
