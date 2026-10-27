import { createRoute } from '@tanstack/react-router';
import { DealersScreen } from '../features/dealers/index.ts';
import { frameRoute } from './frame.tsx';

/** The dealers' rotation board, hours and hands, and the tip-pool share (#124, decision 0252). */
export const dealersRoute = createRoute({ getParentRoute: () => frameRoute, path: '/dealers', component: DealersScreen });
