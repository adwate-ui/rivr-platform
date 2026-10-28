import { createRoute, Outlet } from '@tanstack/react-router';
import { Frame } from '../features/frame/index.ts';
import { WaitingHighHandPrompt } from '../features/jackpots/index.ts';
import { rootRoute } from './root.tsx';

/**
 * Every staff screen sits inside the frame: the rail for the staff member's role, the kill-switch banner, and across
 * the top the high-hand claim waiting for staff who approve them (#317).
 */
export const frameRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'frame',
  component: () => (
    <Frame prompt={(staff) => <WaitingHighHandPrompt {...staff} />}>
      <Outlet />
    </Frame>
  ),
});
