import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** The events calendar (#143). Loaded when first opened, so it does not count against the initial JavaScript budget. */
export const eventsRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/events',
  component: lazyRouteComponent(() => import('../features/events/index.ts'), 'EventsScreen'),
});
