import { createRoute } from '@tanstack/react-router';
import { ProfileScreen } from '../features/profile/index.ts';
import { rootRoute } from './root.tsx';

/** Profile, behind the member's initial. */
export const profileRoute = createRoute({ getParentRoute: () => rootRoute, path: '/profile', component: ProfileScreen });
