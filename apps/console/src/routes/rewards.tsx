import { createRoute, useNavigate } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { RewardsScreen } from '../features/rewards/index.ts';
import { frameRoute } from './frame.tsx';

/** The rewards catalogue, hand-overs, points by hand and the spin wheel (#145, decision 0181; console v3), by tab. */
export const rewardsRoute = createRoute({ getParentRoute: () => frameRoute, path: '/rewards', validateSearch: tabSearchFrom, component: RewardsRoute });

function RewardsRoute() {
  const { tab } = rewardsRoute.useSearch();
  const navigate = useNavigate();
  return <RewardsScreen tab={tab} onNavigate={(href) => void navigate({ href })} />;
}
