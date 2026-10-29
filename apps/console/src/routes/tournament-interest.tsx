import { createRoute } from '@tanstack/react-router';
import { TournamentInterestScreen } from '../features/tournament-interest/index.ts';
import { frameRoute } from './frame.tsx';

/** Who registered interest in each upcoming tournament, marked registered by the floor once they paid (#636). */
export const tournamentInterestRoute = createRoute({ getParentRoute: () => frameRoute, path: '/tournament-interest', component: TournamentInterestScreen });
