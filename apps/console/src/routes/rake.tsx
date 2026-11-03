import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Rake is off the console (decision 0284): an old link or bookmark opens Settings, saying so in a line (#811). */
export const rakeRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/rake', component: () => <Navigate to="/settings" search={{ notice: 'rake' }} replace />,
});
