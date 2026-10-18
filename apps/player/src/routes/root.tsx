import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Frame, NotFound } from '../features/frame/index.ts';

/** Every player screen sits inside the frame: tabs, the member's initial and the kill-switch banner. */
export const rootRoute = createRootRoute({
  component: () => (
    <Frame>
      <Outlet />
    </Frame>
  ),
  notFoundComponent: NotFound,
});
