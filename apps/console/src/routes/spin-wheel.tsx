import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** The spin wheel moved into Rewards (console v3): an old link or bookmark opens its tab there. */
export const spinWheelRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/spin-wheel', component: () => <Navigate to="/rewards" search={{ tab: 'spin' }} replace />,
});
