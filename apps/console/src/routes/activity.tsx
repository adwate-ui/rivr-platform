import { createRoute } from '@tanstack/react-router';
import { ActivityScreen } from '../features/admin/index.ts';
import { frameRoute } from './frame.tsx';

/** Activity (8 Nov audit, F-034): the audit log in words, for super admins. */
export const activityRoute = createRoute({ getParentRoute: () => frameRoute, path: '/activity', component: ActivityScreen });
