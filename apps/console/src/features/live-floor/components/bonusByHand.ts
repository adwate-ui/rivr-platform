import { createContext, useContext, type ReactNode } from 'react';

/** Draws the member record's form for Bonus by hand, for one member at a venue. */
export type DrawBonusByHand = (member: { venueId: string; memberId: string }) => ReactNode;

const BonusByHand = createContext<DrawBonusByHand | null>(null);

/**
 * Hands the floor the member record's form for Bonus by hand (redesign of 15 Nov): the route gives it, as a feature never
 * imports another, and a seated player's sheet shows it to staff who may add Bonus. Floor managers cannot open Members.
 */
export const BonusByHandProvider = BonusByHand.Provider;

/** What the route handed in to draw the form, or null where it handed in nothing. */
export function useBonusByHand(): DrawBonusByHand | null {
  return useContext(BonusByHand);
}
