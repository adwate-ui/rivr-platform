import { createRoute } from '@tanstack/react-router';
import { TiersScreen } from '../features/tiers/index.ts';
import { frameRoute } from './frame.tsx';

/** The tier x feature matrix, saved from a date, and a preview of the player app as any tier (#32). */
export const tiersRoute = createRoute({ getParentRoute: () => frameRoute, path: '/tiers', component: TiersScreen });
