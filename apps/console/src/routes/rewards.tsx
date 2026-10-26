import { createRoute } from '@tanstack/react-router';
import { RewardsScreen } from '../features/rewards/index.ts';
import { frameRoute } from './frame.tsx';

/** The rewards catalogue and redemptions (#145, decision 0181). */
export const rewardsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/rewards', component: RewardsScreen });
