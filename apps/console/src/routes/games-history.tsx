import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Games history moved into Settings (console v3, decision 0455): an old link or bookmark opens its tab there. */
export const gamesHistoryRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/games-history', component: () => <Navigate to="/settings" search={{ tab: 'history' }} replace />,
});
