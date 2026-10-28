import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** TVs moved into Devices (#606): an old link or bookmark opens its tab there. */
export const tvsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/tvs', component: () => <Navigate to="/devices" search={{ tab: 'tvs' }} replace />,
});
