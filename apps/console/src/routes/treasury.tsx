import { createRoute } from '@tanstack/react-router';
import { TreasuryScreen } from '../features/treasury/index.ts';
import { frameRoute } from './frame.tsx';

/** Treasury (#24): what the venue holds, the chips in play, and the cage's shift and chip count. */
export const treasuryRoute = createRoute({ getParentRoute: () => frameRoute, path: '/treasury', component: TreasuryScreen });