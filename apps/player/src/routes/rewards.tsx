import { createRoute } from '@tanstack/react-router';
import { RewardsScreen } from '../features/rewards/index.ts';
import { frameRoute } from './frame.tsx';

/** Rewards. */
export const rewardsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/rewards', component: RewardsScreen });
