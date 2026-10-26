import { createRoute } from '@tanstack/react-router';
import { TallyScreen } from '../features/reports/index.ts';
import { frameRoute } from './frame.tsx';

/** A club day's vouchers for Tally, and the accounts' Tally ledgers (#96). */
export const tallyRoute = createRoute({ getParentRoute: () => frameRoute, path: '/tally', component: TallyScreen });
