import { createRoute } from '@tanstack/react-router';
import { PracticeResetScreen } from '../features/admin/index.ts';
import { frameRoute } from './frame.tsx';

/** Practice reset (#104): reset the practice venue to its seed, for super admins. */
export const practiceResetRoute = createRoute({ getParentRoute: () => frameRoute, path: '/practice-reset', component: PracticeResetScreen });
