import { createRoute } from '@tanstack/react-router';
import { LiveFloorScreen } from '../features/live-floor/index.ts';
import { frameRoute } from './frame.tsx';

/** The console opens on the live floor. */
export const homeRoute = createRoute({ getParentRoute: () => frameRoute, path: '/', component: LiveFloorScreen });
