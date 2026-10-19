import { createRoute } from '@tanstack/react-router';
import { JackpotsScreen } from '../features/jackpots/index.ts';
import { frameRoute } from './frame.tsx';

/** The jackpot's pools, bad-beat payouts and their reversals (#48). */
export const jackpotsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/jackpots', component: JackpotsScreen });
