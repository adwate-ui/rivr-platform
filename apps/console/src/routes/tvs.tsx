import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** TVs moved into Devices (#606), now a tab of Settings (console v3): an old link or bookmark opens them there. */
export const tvsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/tvs', component: () => <Navigate to="/settings" search={{ tab: 'devices', part: 'tvs' }} replace />,
});
