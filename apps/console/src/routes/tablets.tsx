import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Tablets moved into Devices (#606), now a tab of Settings (console v3): an old link or bookmark opens them there. */
export const tabletsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/tablets', component: () => <Navigate to="/settings" search={{ tab: 'tablets' }} replace />,
});
