import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Time requests moved into Requests (console v3, decision 0479): an old link or bookmark opens it. */
export const timeRequestsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/time-requests', component: () => <Navigate to="/requests" replace />,
});
