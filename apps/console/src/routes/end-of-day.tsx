import { createRoute } from '@tanstack/react-router';
import { EndOfDayScreen } from '../features/treasury/index.ts';
import { frameRoute } from './frame.tsx';

/** End of day (#45): closing the cage's shift against the ledger, and an anomaly's review. */
export const endOfDayRoute = createRoute({ getParentRoute: () => frameRoute, path: '/end-of-day', component: EndOfDayScreen });