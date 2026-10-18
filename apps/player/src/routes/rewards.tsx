import { createRoute } from '@tanstack/react-router';
import { RewardsScreen } from '../features/rewards/index.ts';
import { rootRoute } from './root.tsx';

/** Rewards. */
export const rewardsRoute = createRoute({ getParentRoute: () => rootRoute, path: '/rewards', component: RewardsScreen });
