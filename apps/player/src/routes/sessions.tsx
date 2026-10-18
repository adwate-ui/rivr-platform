import { createRoute } from '@tanstack/react-router';
import { SessionsScreen } from '../features/sessions/index.ts';
import { frameRoute } from './frame.tsx';

/** Session history, gated by tier inside the feature. */
export const sessionsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/sessions', component: SessionsScreen });
