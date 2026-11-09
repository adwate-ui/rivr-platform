import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Computers are off the console (#626): an old link or bookmark opens Devices, saying so in a line (#811). */
export const computersRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/computers', component: () => <Navigate to="/settings" search={{ tab: 'tvs', notice: 'computers' }} replace />,
});
