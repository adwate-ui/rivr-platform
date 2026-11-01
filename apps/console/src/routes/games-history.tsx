import { createRoute } from '@tanstack/react-router';
import { GamesHistoryScreen } from '../features/games-history/index.ts';
import { frameRoute } from './frame.tsx';

/** The tables run each club day and how long each ran, for the super admin (#643). */
export const gamesHistoryRoute = createRoute({ getParentRoute: () => frameRoute, path: '/games-history', component: GamesHistoryScreen });
