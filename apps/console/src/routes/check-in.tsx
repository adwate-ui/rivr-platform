import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Check-in moved to the Door (console v3): an old link or bookmark opens its tab there. */
export const checkInRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/check-in', component: () => <Navigate to="/door" search={{ tab: 'checkin' }} replace />,
});
