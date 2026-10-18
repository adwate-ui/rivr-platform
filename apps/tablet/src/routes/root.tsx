import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Frame, NotFound } from '../features/frame/index.ts';

/** Every tablet screen sits inside the frame: the table name and the kill-switch banner. */
export const rootRoute = createRootRoute({
  component: () => (
    <Frame>
      <Outlet />
    </Frame>
  ),
  notFoundComponent: NotFound,
});
