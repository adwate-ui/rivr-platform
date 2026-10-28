import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Tablets moved into Devices (#606): an old link or bookmark opens its tab there. */
export const tabletsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/tablets', component: () => <Navigate to="/devices" search={{ tab: 'tablets' }} replace />,
});
