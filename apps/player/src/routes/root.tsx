import { createRootRoute, Outlet } from '@tanstack/react-router';
import { CookieChoices, Frame, NotFound } from '../features/frame/index.ts';

/** The app: sign-in on its own, every other screen inside the frame (routes/frame.tsx); the cookie banner over all of them. */
export const rootRoute = createRootRoute({
  component: () => (
    <>
      <Outlet />
      <CookieChoices />
    </>
  ),
  notFoundComponent: () => (
    <Frame>
      <NotFound />
    </Frame>
  ),
});
