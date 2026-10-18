import { createRoute, Outlet } from '@tanstack/react-router';
import { Frame } from '../features/frame/index.ts';
import { rootRoute } from './root.tsx';

/** Every staff screen sits inside the frame: the rail for the staff member's role and the kill-switch banner. */
export const frameRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'frame',
  component: () => (
    <Frame>
      <Outlet />
    </Frame>
  ),
});
