import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Rewards: points and the catalogue. Loaded when first opened, so it does not count against the initial JavaScript budget. */
export const rewardsRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/rewards',
  component: lazyRouteComponent(() => import('../features/rewards/index.ts'), 'RewardsScreen'),
});
