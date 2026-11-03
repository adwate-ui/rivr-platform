import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Top-ups moved into Requests (console v3, decision 0446): an old link or bookmark opens it. */
export const topUpsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/top-ups', component: () => <Navigate to="/requests" replace />,
});
