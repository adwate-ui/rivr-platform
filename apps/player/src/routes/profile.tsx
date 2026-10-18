import { createRoute, lazyRouteComponent } from '@tanstack/react-router';
import { frameRoute } from './frame.tsx';

// Loaded when first opened, so Profile does not count against the initial JavaScript budget.
const profile = () => import('../features/profile/index.ts');

/** Profile, behind the member's initial. */
export const profileRoute = createRoute({ getParentRoute: () => frameRoute, path: '/profile', component: lazyRouteComponent(profile, 'ProfileScreen') });

/** Limits and self-exclusion, from Profile. */
export const limitsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/profile/limits', component: lazyRouteComponent(profile, 'LimitsScreen') });
