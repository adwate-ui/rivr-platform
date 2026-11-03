import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Today's players moved into the Door (console v3): an old link or bookmark opens its tab there. */
export const playersTodayRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/players-today', component: () => <Navigate to="/door" search={{ tab: 'players' }} replace />,
});
