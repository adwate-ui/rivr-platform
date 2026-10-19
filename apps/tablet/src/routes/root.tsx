import { createRootRoute, Outlet } from '@tanstack/react-router';
import { Frame, NotFound } from '../features/frame/index.ts';
import { PairScreen } from '../features/pairing/index.ts';

/** Every tablet screen sits inside the frame: the table name and the kill-switch banner, or pairing first. */
export const rootRoute = createRootRoute({
  component: () => (
    <Frame unpaired={<PairScreen />}>
      <Outlet />
    </Frame>
  ),
  notFoundComponent: NotFound,
});
