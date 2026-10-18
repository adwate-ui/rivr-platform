import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Frame, NotFound } from '../features/frame/index.ts';

/** Every TV mode sits inside the frame. */
export const rootRoute = createRootRoute({
  component: () => (
    <Frame>
      <Outlet />
    </Frame>
  ),
  notFoundComponent: NotFound,
});
