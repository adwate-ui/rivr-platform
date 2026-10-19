import { createRoute } from '@tanstack/react-router';
import { HighHandsScreen } from '../features/high-hands/index.ts';
import { frameRoute } from './frame.tsx';

/** High hands claimed on the tablets: approve and pay, or reject; and the history (#47). */
export const highHandsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/high-hands', component: HighHandsScreen });
