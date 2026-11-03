import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Tournament interest moved into the Waitlist (console v3): an old link or bookmark opens its tab there. */
export const tournamentInterestRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/tournament-interest', component: () => <Navigate to="/waitlist" search={{ tab: 'interest' }} replace />,
});
