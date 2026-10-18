import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

/**
 * Sign-in: full screen, outside the frame's tabs. Loaded on its own, so its forms do not count
 * against the player app's initial JavaScript budget (200 KB gzipped).
 */
export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  component: lazyRouteComponent(() => import('../features/sign-in/index.ts'), 'SignInScreen'),
});
