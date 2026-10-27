import { createRootRoute, createRoute, Outlet } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { Frame, NotFound } from '../features/frame/index.ts';
import { PairingScreen } from '../features/pairing/index.ts';

/** The TV's frame, which shows the pairing code until the TV is paired. */
function TvFrame({ children }: { children: ReactNode }) {
  return <Frame unpaired={<PairingScreen />}>{children}</Frame>;
}

/** Every route sits under the root; the stream overlay (#125) draws its own page, outside the TV's frame. */
export const rootRoute = createRootRoute({
  component: Outlet,
  notFoundComponent: () => <TvFrame><NotFound /></TvFrame>,
});

/** Every TV mode sits inside the TV's frame. */
export const tvRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'tv',
  component: () => <TvFrame><Outlet /></TvFrame>,
});
