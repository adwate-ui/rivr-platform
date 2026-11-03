import { createRoute, Navigate } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Learn content moved into Content (console v3): an old link or bookmark opens its tab there. */
export const learnSourcesRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/learn-sources', component: () => <Navigate to="/content" search={{ tab: 'learn' }} replace />,
});
