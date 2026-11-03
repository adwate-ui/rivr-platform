import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { rootRoute } from './root.tsx';

/** `?why=idle`: the idle lock signed the staff member out, and sign-in says so (#811). */
function signInSearchFrom(search: Record<string, unknown>): { why?: 'idle' } {
  return search['why'] === 'idle' ? { why: 'idle' } : {};
}

/** Sign-in: full screen, outside the frame's rail, loaded on its own. */
export const signInRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/sign-in',
  validateSearch: signInSearchFrom,
  component: lazyRouteComponent(() => import('../features/sign-in/index.ts'), 'SignInScreen'),
});
