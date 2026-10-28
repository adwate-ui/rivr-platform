import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** High hands moved into Jackpots (#606): an old link or bookmark opens its tab there. */
export const highHandsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/high-hands', component: () => <Navigate to="/jackpots" search={{ tab: 'highHands' }} replace />,
});
