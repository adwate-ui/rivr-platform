import { createRoute } from '@tanstack/react-router';
import { CheckInScreen, TodaysPlayersScreen } from '../features/check-in/index.ts';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { MemberHistory } from '../features/members/index.ts';
import { frameRoute } from './frame.tsx';

// A member's History from the Door (#1073): the members feature draws it, the door opens it.
const CheckIn = () => <CheckInScreen history={MemberHistory} />;
const TodaysPlayers = () => <TodaysPlayersScreen history={MemberHistory} />;

/** The door (console v3): Check-in, then Today's players, by tab (`?tab=check-in|players`). */
export const doorRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/door', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="door" panes={{ 'check-in': CheckIn, players: TodaysPlayers }} />,
});
