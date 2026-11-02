import { ToastProvider } from '@rivr/ui';
import { createRootRoute, Outlet } from '@tanstack/react-router';
import { CookieChoices, Frame, NotFound } from '../features/frame/index.ts';

/**
 * The app: sign-in on its own, every other screen inside the frame (routes/frame.tsx); the cookie choice over all of them,
 * and the toasts that confirm a member's own action (decision 0320).
 */
export const rootRoute = createRootRoute({
  component: () => (
    <ToastProvider>
      <Outlet />
      <CookieChoices />
    </ToastProvider>
  ),
  notFoundComponent: () => (
    <Frame>
      <NotFound />
    </Frame>
  ),
});
