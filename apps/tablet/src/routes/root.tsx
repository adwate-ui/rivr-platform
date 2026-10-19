import { createRootRoute, Outlet } from '@tanstack/react-router';
import { DealerSignInScreen } from '../features/dealer-sign-in/index.ts';
import { Frame, NotFound } from '../features/frame/index.ts';
import { PairScreen } from '../features/pairing/index.ts';

/**
 * Every tablet screen sits inside the frame: the table name and the kill-switch banner, pairing
 * first, then a dealer's sign-in between downs.
 */
export const rootRoute = createRootRoute({
  component: () => (
    <Frame unpaired={<PairScreen />} signIn={<DealerSignInScreen />}>
      <Outlet />
    </Frame>
  ),
  notFoundComponent: NotFound,
});
