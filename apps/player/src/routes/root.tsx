import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Frame, NotFound } from '../features/frame/index.ts';

/** The app: sign-in on its own, every other screen inside the frame (routes/frame.tsx). */
export const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => (
    <Frame>
      <NotFound />
    </Frame>
  ),
});
