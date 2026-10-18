import { createRoute } from '@tanstack/react-router';
import { PickupsScreen } from '../features/pickups/index.ts';
import { rootRoute } from './root.tsx';

/** The driver's pickups. */
export const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: PickupsScreen });
