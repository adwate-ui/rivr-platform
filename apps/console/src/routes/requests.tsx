import { createRoute } from '@tanstack/react-router';
import { RequestsScreen } from '../features/live-floor/index.ts';
import { frameRoute } from './frame.tsx';

/**
 * Requests (console v3): the phone's tab for every request waiting on the floor, oldest first, with its actions and Undo;
 * from 768 px they sit beside the Live floor (decision 0446).
 */
export const requestsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/requests', component: RequestsScreen });
