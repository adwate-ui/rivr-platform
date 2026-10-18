import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Learn: the library and drills. Loaded when first opened, so it does not count against the initial JavaScript budget. */
export const learnRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/learn',
  component: lazyRouteComponent(() => import('../features/learn/index.ts'), 'LearnScreen'),
});
