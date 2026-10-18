import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Balance: the member's money at the club. Loaded when first opened, so it does not count against the initial JavaScript budget. */
export const balanceRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/balance',
  component: lazyRouteComponent(() => import('../features/balance/index.ts'), 'BalanceScreen'),
});
