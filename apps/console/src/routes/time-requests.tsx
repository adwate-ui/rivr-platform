import { createRoute } from '@tanstack/react-router';
import { TimeRequestsScreen } from '../features/time-requests/index.ts';
import { frameRoute } from './frame.tsx';

/** More call time members asked for, on a page of their own (decision 0305). */
export const timeRequestsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/time-requests', component: TimeRequestsScreen });
