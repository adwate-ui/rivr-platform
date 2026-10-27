import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

// Loaded when first opened, so Sessions does not count against the initial JavaScript budget.
const sessions = () => import('../features/sessions/index.ts');

/** Sessions: the member's played sessions by club month, and their TDS certificate data. */
export const sessionsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/sessions', component: lazyRouteComponent(sessions, 'SessionsScreen') });

/** One session's detail, with its receipt (#127). */
export const sessionRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/sessions/$visitId',
  component: lazyRouteComponent(sessions, 'SessionScreen'),
});
