import { createRoute } from '@tanstack/react-router';
import { CheckInScreen, TodaysPlayersScreen } from '../features/check-in/index.ts';
import { ScreenTabs, screenSearchFrom } from '../features/frame/index.ts';
import { MemberHistory, UseBonus } from '../features/members/index.ts';
import { frameRoute } from './frame.tsx';

// A member's History (#1073) and Use Bonus (the owner, 20 Nov) from the Door: the members feature draws them, the door opens them.
const CheckIn = () => <CheckInScreen history={MemberHistory} bonusForm={UseBonus} />;
const TodaysPlayers = () => <TodaysPlayersScreen history={MemberHistory} />;

/** The door (console v3): Check-in, then Today's players, by tab (`?tab=check-in|players`). */
export const doorRoute = createRoute({
  getParentRoute: () => frameRoute, path: '/door', validateSearch: screenSearchFrom,
  component: () => <ScreenTabs screen="door" panes={{ 'check-in': CheckIn, players: TodaysPlayers }} />,
});
