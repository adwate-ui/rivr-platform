import { createRoute } from '@tanstack/react-router';
import { TournamentsScreen } from '../features/tournaments/index.ts';
import { frameRoute } from './frame.tsx';

/** Tournaments: the clock, the tournaments, their templates and blind structures (#115, #116, #119). */
export const tournamentsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/tournaments', component: TournamentsScreen });
