import { createRoute } from '@tanstack/react-router';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { TournamentInterestScreen } from '../features/tournament-interest/index.ts';
import { WaitlistScreen } from '../features/waitlist/index.ts';
import { frameRoute } from './frame.tsx';

/** Waitlist (console v3): each table's own list (decision 0433), then the tournament interest list, by tab (`?tab=lists|interest`). */
export const waitlistRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/waitlist', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="waitlist" panes={{ lists: WaitlistScreen, interest: TournamentInterestScreen }} />,
});
