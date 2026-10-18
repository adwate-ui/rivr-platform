import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { returnSearchFrom } from '../features/frame/index.ts';
import { rootRoute } from './root.tsx';

/**
 * Joining the club after the first code: full screen, like sign-in, and loaded on its own. `?next=`
 * is the screen a link pointed at, opened once joined.
 */
export const signUpRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-up',
  validateSearch: returnSearchFrom,
  component: lazyRouteComponent(() => import('../features/sign-up/index.ts'), 'SignUpScreen'),
});
