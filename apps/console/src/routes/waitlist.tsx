import { createRoute } from '@tanstack/react-router';
import { tabSearchFrom } from '../features/frame/index.ts';
import { TournamentInterestList } from '../features/tournament-interest/index.ts';
import { WaitlistScreen } from '../features/waitlist/index.ts';
import { frameRoute } from './frame.tsx';

/** Waitlist (console v3): each table's own list (decision 0433), and the tournament interest list, by tab (`?tab=`). */
export const waitlistRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/waitlist', validateSearch: tabSearchFrom,
  component: () => <WaitlistScreen interest={<TournamentInterestList />} />,
});
