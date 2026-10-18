import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Sessions: the member's played sessions. Loaded when first opened, so it does not count against the initial JavaScript budget. */
export const sessionsRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/sessions',
  component: lazyRouteComponent(() => import('../features/sessions/index.ts'), 'SessionsScreen'),
});
