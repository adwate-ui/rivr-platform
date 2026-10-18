import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Home: tonight at the club. Loaded when first opened, so it does not count against the initial JavaScript budget. */
export const tonightRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/',
  component: lazyRouteComponent(() => import('../features/home/index.ts'), 'HomeScreen'),
});
