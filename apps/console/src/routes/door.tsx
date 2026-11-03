import { createRoute } from '@tanstack/react-router';
import { CheckInScreen } from '../features/check-in/index.ts';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { TodaysPlayersScreen } from '../features/todays-players/index.ts';
import { HandOverScreen } from '../features/rewards/index.ts';
import { frameRoute } from './frame.tsx';

/** The door (console v3): Check-in, Today's players, then Hand over, by tab (`?tab=check-in|players|handover`). */
export const doorRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/door', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="door" panes={{ 'check-in': CheckInScreen, players: TodaysPlayersScreen, handover: HandOverScreen }} />,
});
