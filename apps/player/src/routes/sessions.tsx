import { createRoute } from '@tanstack/react-router';
import { SessionsScreen } from '../features/sessions/index.ts';
import { rootRoute } from './root.tsx';

/** Session history, gated by tier inside the feature. */
export const sessionsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/sessions', component: SessionsScreen });
