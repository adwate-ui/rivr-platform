import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Treasury moved into Shift (#606): an old link or bookmark opens its tab there. */
export const treasuryRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/treasury', component: () => <Navigate to="/shift" search={{ tab: 'now' }} replace />,
});
