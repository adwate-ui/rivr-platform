import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { returnSearchFrom } from '../features/frame/index.ts';
import { rootRoute } from './root.tsx';

/**
 * Sign-in: full screen, outside the frame's tabs. Loaded on its own, so its forms do not count
 * against the player app's initial JavaScript budget (200 KB gzipped). `?next=` is the screen a link
 * pointed at, opened once signed in (#233).
 */
export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  validateSearch: returnSearchFrom,
  component: lazyRouteComponent(() => import('../features/sign-in/index.ts'), 'SignInScreen'),
});
