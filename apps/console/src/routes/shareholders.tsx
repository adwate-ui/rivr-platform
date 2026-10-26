import { createRoute } from '@tanstack/react-router';
import { ShareholdersScreen } from '../features/admin/index.ts';
import { frameRoute } from './frame.tsx';

/** The shareholding register, for super admins (#97). */
export const shareholdersRoute = createRoute({ getParentRoute: () => frameRoute, path: '/shareholders', component: ShareholdersScreen });
