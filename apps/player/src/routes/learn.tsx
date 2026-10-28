import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Learn: the library. Loaded when first opened, so it does not count against the initial JavaScript budget. */
export const learnRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/learn',
  component: lazyRouteComponent(() => import('../features/learn/index.ts'), 'LearnScreen'),
});

/** A licensed title: its hub, drills and review (#133, #136). Loaded when first opened: it carries the drill engine. */
export const learnBookRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/learn/$sourceKey',
  component: lazyRouteComponent(() => import('../features/learn/index.ts'), 'BookScreen'),
});
