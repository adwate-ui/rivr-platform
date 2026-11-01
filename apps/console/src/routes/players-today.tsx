import { createRoute } from '@tanstack/react-router';
import { TodaysPlayersScreen } from '../features/todays-players/index.ts';
import { frameRoute } from './frame.tsx';

/** Every member at the club today, with their status, times and tables (#641). */
export const playersTodayRoute = createRoute({ getParentRoute: () => frameRoute, path: '/players-today', component: TodaysPlayersScreen });
