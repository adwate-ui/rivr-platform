import { createRoute, Outlet } from '@tanstack/react-router';
import { Frame } from '../features/frame/index.ts';
import { rootRoute } from './root.tsx';

/**
 * Every staff screen sits inside the frame: the rail for the staff member's role and the kill-switch banner. The
 * high-hand claim prompt (#317) is off it: it asks to approve a payout in rupees, and Jackpots is hidden (owner,
 * 29 Oct, #626, decision 0284). WaitingHighHandPrompt stays in features/jackpots for when the club wants it back.
 */
export const frameRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'frame',
  component: () => (
    <Frame>
      <Outlet />
    </Frame>
  ),
});
