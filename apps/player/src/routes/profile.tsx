import { createRoute } from '@tanstack/react-router';
import { ProfileScreen } from '../features/profile/index.ts';
import { frameRoute } from './frame.tsx';

/** Profile, behind the member's initial. */
export const profileRoute = createRoute({ getParentRoute: () => frameRoute, path: '/profile', component: ProfileScreen });
