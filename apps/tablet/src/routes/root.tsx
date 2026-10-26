import { createRootRoute, Outlet } from '@tanstack/react-router';
import { DealerSignInScreen } from '../features/dealer-sign-in/index.ts';
import { DoorScreen } from '../features/door/index.ts';
import { Frame, NotFound } from '../features/frame/index.ts';
import { PairScreen } from '../features/pairing/index.ts';

/**
 * Every tablet screen sits inside the frame: the table name and the kill-switch banner, pairing
 * first, then a dealer's sign-in between downs; a door kiosk shows its card scanner (decision 0164).
 */
export const rootRoute = createRootRoute({
  component: () => (
    <Frame unpaired={<PairScreen />} signIn={<DealerSignInScreen />} door={<DoorScreen />}>
      <Outlet />
    </Frame>
  ),
  notFoundComponent: NotFound,
});
