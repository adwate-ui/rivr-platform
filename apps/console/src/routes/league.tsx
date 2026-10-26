import { createRoute } from '@tanstack/react-router';
import { LeagueScreen } from '../features/league/index.ts';
import { frameRoute } from './frame.tsx';

/** The RIVR League's standings and seasons (#147, decision 0182). */
export const leagueRoute = createRoute({ getParentRoute: () => frameRoute, path: '/league', component: LeagueScreen });
