import { createRoute } from '@tanstack/react-router';
import { LimitsScreen, ProfileScreen } from '../features/profile/index.ts';
import { frameRoute } from './frame.tsx';

/** Profile, behind the member's initial. */
export const profileRoute = createRoute({ getParentRoute: () => frameRoute, path: '/profile', component: ProfileScreen });

/** Limits and self-exclusion, from Profile. */
export const limitsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/profile/limits', component: LimitsScreen });
