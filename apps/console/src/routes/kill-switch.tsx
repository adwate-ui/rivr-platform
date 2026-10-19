import { createRoute } from '@tanstack/react-router';
import { KillSwitchScreen } from '../features/admin/index.ts';
import { frameRoute } from './frame.tsx';

/** Kill switch (#27): engage and release the venue's controls, for super admins. */
export const killSwitchRoute = createRoute({ getParentRoute: () => frameRoute, path: '/kill-switch', component: KillSwitchScreen });
