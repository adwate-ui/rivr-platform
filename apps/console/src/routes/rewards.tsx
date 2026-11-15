import { createRoute } from '@tanstack/react-router';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { GiveBonusChips } from '../features/members/index.ts';
import { RewardsPointsScreen, RewardsScreen } from '../features/rewards/index.ts';
import { frameRoute } from './frame.tsx';

/** Points by hand, with the member record's form for Bonus by hand: floor managers cannot open Members. */
const PointsPane = () => <RewardsPointsScreen BonusForm={GiveBonusChips} />;

/** Rewards (#145, decision 0181; console v3): the catalogue and points by hand, by tab (`?tab=rewards|points`). */
export const rewardsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/rewards', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="rewards" panes={{ rewards: RewardsScreen, points: PointsPane }} />,
});
