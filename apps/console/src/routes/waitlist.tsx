import { createRoute } from '@tanstack/react-router';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { WaitlistScreen } from '../features/waitlist/index.ts';
import { frameRoute } from './frame.tsx';

/** Waitlist (console v3): each table's own list (decision 0467). Tournament interest moved to Tournaments (redesign RD-26). */
export const waitlistRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/waitlist', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="waitlist" panes={{ lists: WaitlistScreen }} />,
});
