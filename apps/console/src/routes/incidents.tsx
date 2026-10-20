import { createRoute } from '@tanstack/react-router';
import { IncidentsScreen } from '../features/incidents/index.ts';
import { frameRoute } from './frame.tsx';

/** The incident log, the club's contacts and its drills (#53). */
export const incidentsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/incidents', component: IncidentsScreen });
