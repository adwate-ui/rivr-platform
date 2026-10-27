import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Food and drink from the member's seat (#123). Loaded when first opened, so it does not count against the initial JavaScript budget. */
export const fnbRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/fnb',
  component: lazyRouteComponent(() => import('../features/fnb/index.ts'), 'FnbOrderScreen'),
});
