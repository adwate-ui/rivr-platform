import { createRootRoute, Outlet } from '@tanstack/react-router';
import { AppRoot, Frame, NotFound } from '../features/frame/index.ts';

/**
 * The app: sign-in on its own, every other screen inside the frame (routes/frame.tsx); around all of them, the toasts and
 * the cookie choice (decision 0320).
 */
export const rootRoute = createRootRoute({
  component: () => (
    <AppRoot>
      <Outlet />
    </AppRoot>
  ),
  notFoundComponent: () => (
    <Frame>
      <NotFound />
    </Frame>
  ),
});
