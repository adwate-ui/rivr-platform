import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

/** Food and drink from the member's seat (#123). Loaded when first opened, so it does not count against the initial JavaScript budget. */
export const fnbRoute = createRoute({
  getParentRoute: () => frameRoute,
  path: '/fnb',
  // Order again (decision 0320): the order of tonight's to start from.
  validateSearch: (search: Record<string, unknown>): { again?: string | undefined } => ({ again: typeof search.again === 'string' ? search.again : undefined }),
  component: lazyRouteComponent(() => import('../features/fnb/index.ts'), 'FnbOrderScreen'),
});
