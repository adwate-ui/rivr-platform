import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Devices moved into Settings (console v3): an old link or bookmark opens its tab there. */
export const devicesRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/devices', component: () => <Navigate to="/settings" search={{ tab: 'devices' }} replace />,
});
