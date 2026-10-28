import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Learn sources (#131). Loaded when first opened: it carries the drill engine, which checks an encoding before upload. */
export const learnSourcesRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/learn-sources',
  component: lazyRouteComponent(() => import('../features/learn-sources/index.ts'), 'LearnSourcesScreen'),
});
