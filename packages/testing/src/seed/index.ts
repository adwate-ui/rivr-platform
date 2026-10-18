import { badBeatJackpot, highHand, promotions, tournament } from './floor.ts';
import { arjun, dealer, dealerDown, members, waitlist } from './people.ts';
import { practiceVenue, tables, venue } from './tables.ts';
import { ist } from './time.ts';

/**
 * The seed state of the design prompt (section 5) with the six tables of the 14 Oct additions.
 * Amounts are paise; times are UTC Dates. The clock reads Tuesday 00:10 IST, the Tuesday after
 * the 15 Nov launch.
 */
export const designPromptSeed = {
  clock: ist('2026-11-17 00:10'),
  venue,
  practiceVenue,
  tables,
  members,
  arjun,
  waitlist,
  dealer,
  dealerDown,
  badBeatJackpot,
  highHand,
  tournament,
  promotions,
};

export { ist } from './time.ts';
export { STAKES_50_100, STAKES_100_200, seedUuid } from './tables.ts';
export type * from './types.ts';
