import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Time requests moved into Requests (console v3): an old link or bookmark opens its tab there. */
export const timeRequestsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/time-requests', component: () => <Navigate to="/requests" search={{ tab: 'time' }} replace />,
});
