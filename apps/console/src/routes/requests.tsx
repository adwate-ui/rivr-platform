import { createRoute } from '@tanstack/react-router';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { TimeRequestsScreen } from '../features/time-requests/index.ts';
import { TopUpsScreen } from '../features/top-ups/index.ts';
import { frameRoute } from './frame.tsx';

/**
 * Requests (console v3): the phone's tab for every request waiting on the floor; from 768 px they sit beside the Live
 * floor. Until the Live floor's requests land, today's top-ups and time requests by tab (`?tab=top-ups|time`).
 */
export const requestsRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/requests', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="requests" panes={{ 'top-ups': TopUpsScreen, time: TimeRequestsScreen }} />,
});
