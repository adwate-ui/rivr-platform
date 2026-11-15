import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Bonus: the balance, its history and Refer a friend. Loaded when first opened, so it does not count against the initial JavaScript budget. */
export const bonusRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/bonus',
  component: lazyRouteComponent(() => import('../features/bonus/index.ts'), 'BonusScreen'),
});
