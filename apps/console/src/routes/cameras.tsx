import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Cameras moved into Devices (#606): an old link or bookmark opens its tab there. */
export const camerasRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/cameras', component: () => <Navigate to="/devices" search={{ tab: 'cameras' }} replace />,
});
