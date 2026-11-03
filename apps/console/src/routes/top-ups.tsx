import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Top-ups moved into Requests (console v3): an old link or bookmark opens its tab there. */
export const topUpsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/top-ups', component: () => <Navigate to="/requests" search={{ tab: 'top-ups' }} replace />,
});
