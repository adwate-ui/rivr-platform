import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** The website moved into Content (console v3): an old link or bookmark opens its tab there. */
export const websiteRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/website', component: () => <Navigate to="/content" search={{ tab: 'website' }} replace />,
});
