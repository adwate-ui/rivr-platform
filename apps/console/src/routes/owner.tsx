import { createRoute } from '@tanstack/react-router';
import { OwnerDashboardScreen } from '../features/owner-dashboard/index.ts';
import { frameRoute } from './frame.tsx';

/** The owner dashboard (#101): tonight, the room, the cash position and alerts, live. */
export const ownerRoute = createRoute({ getParentRoute: () => frameRoute, path: '/owner', component: OwnerDashboardScreen });
