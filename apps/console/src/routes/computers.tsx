import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Computers moved into Devices (#606): an old link or bookmark opens its tab there. */
export const computersRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/computers', component: () => <Navigate to="/devices" search={{ tab: 'computers' }} replace />,
});
