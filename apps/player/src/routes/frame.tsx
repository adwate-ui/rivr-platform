import { createRoute, Outlet } from '@tanstack/react-router';
import { Frame } from '../features/frame/index.ts';
import { rootRoute } from './root.tsx';

/** Every signed-in screen sits inside the frame: tabs, the member's initial and the kill-switch banner. */
export const frameRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'frame',
  component: () => (
    <Frame>
      <Outlet />
    </Frame>
  ),
});
