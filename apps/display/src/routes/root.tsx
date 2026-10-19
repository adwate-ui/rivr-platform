import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Frame, NotFound } from '../features/frame/index.ts';
import { PairingScreen } from '../features/pairing/index.ts';

/** Every TV mode sits inside the frame, which shows the pairing code until the TV is paired. */
export const rootRoute = createRootRoute({
  component: () => (
    <Frame unpaired={<PairingScreen />}>
      <Outlet />
    </Frame>
  ),
  notFoundComponent: NotFound,
});
