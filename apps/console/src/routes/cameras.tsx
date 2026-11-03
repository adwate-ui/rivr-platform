import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Cameras are off the console (#626): an old link or bookmark opens Devices, saying so in a line (#811). */
export const camerasRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/cameras', component: () => <Navigate to="/settings" search={{ tab: 'devices', notice: 'cameras' }} replace />,
});
