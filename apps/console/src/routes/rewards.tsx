import { createRoute } from '@tanstack/react-router';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { RewardsPointsScreen, RewardsScreen } from '../features/rewards/index.ts';
import { SpinWheelScreen } from '../features/spin-wheel/index.ts';
import { frameRoute } from './frame.tsx';

/** Rewards (#145, decision 0181; console v3): the catalogue, points by hand and the spin wheel, by tab (`?tab=rewards|points|spin-wheel`). */
export const rewardsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/rewards', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="rewards" panes={{ rewards: RewardsScreen, points: RewardsPointsScreen, 'spin-wheel': SpinWheelScreen }} />,
});
