import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** End of day moved into Shift (#606): an old link or bookmark opens its tab there. */
export const endOfDayRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/end-of-day', component: () => <Navigate to="/shift" search={{ tab: 'close' }} replace />,
});
