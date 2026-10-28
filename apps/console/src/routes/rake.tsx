import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Rake moved into Settings, as its Rake area (#604): an old link or bookmark to /rake opens it there. */
export const rakeRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/rake', component: () => <Navigate to="/settings" search={{ tab: 'rake' }} replace />,
});
