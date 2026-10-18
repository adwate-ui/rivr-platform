import { createRoute } from '@tanstack/react-router';
import { LiveFloorScreen } from '../features/live-floor/index.ts';
import { rootRoute } from './root.tsx';

/** The console opens on the live floor. */
export const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: '/', component: LiveFloorScreen });
