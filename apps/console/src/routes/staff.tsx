import { createRoute } from '@tanstack/react-router';
import { StaffScreen } from '../features/staff/index.ts';
import { frameRoute } from './frame.tsx';

/** The venue's staff: job titles apart from roles; add, change, turn off (#28). */
export const staffRoute = createRoute({ getParentRoute: () => frameRoute, path: '/staff', component: StaffScreen });
