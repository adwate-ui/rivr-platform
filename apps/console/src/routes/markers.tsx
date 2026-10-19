import { createRoute } from '@tanstack/react-router';
import { MarkersScreen } from '../features/markers/index.ts';
import { frameRoute } from './frame.tsx';

/** Markers (#73): credit lines, limits waiting for approval and the room's exposure. */
export const markersRoute = createRoute({ getParentRoute: () => frameRoute, path: '/markers', component: MarkersScreen });
