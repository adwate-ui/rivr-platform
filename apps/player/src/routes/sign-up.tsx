import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

/** Joining the club after the first code: full screen, like sign-in, and loaded on its own. */
export const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-up',
  component: lazyRouteComponent(() => import('../features/sign-up/index.ts'), 'SignUpScreen'),
});
