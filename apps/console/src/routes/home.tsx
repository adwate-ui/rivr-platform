import { createRoute } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { BonusByHandProvider, floorSearchFrom, LiveFloorScreen } from '../features/live-floor/index.ts';
import { GiveBonusChips } from '../features/members/index.ts';
import { frameRoute } from './frame.tsx';

/** The member record's form for Bonus by hand, drawn in a seated player's sheet. */
const drawBonusByHand = (member: { venueId: string; memberId: string }) => <GiveBonusChips venueId={member.venueId} memberId={member.memberId} />;

/** Gives the floor's screens Bonus by hand in a seated player's sheet: floor managers cannot open Members (decision 0585). */
export function WithBonusByHand({ children }: { children: ReactNode }) {
  return <BonusByHandProvider value={drawBonusByHand}>{children}</BonusByHandProvider>;
}

const LiveFloor = () => (
  <WithBonusByHand>
    <LiveFloorScreen />
  </WithBonusByHand>
);

/** The console opens on the live floor; `?table=<id>&seat=<n>` opens that seat, as a member record's Show does. */
export const homeRoute = createRoute({ getParentRoute: () => frameRoute, path: '/', validateSearch: floorSearchFrom, component: LiveFloor });
