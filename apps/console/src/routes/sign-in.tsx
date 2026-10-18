import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

/** Sign-in: full screen, outside the frame's rail, loaded on its own. */
export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  component: lazyRouteComponent(() => import('../features/sign-in/index.ts'), 'SignInScreen'),
});
