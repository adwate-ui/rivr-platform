/** The dealer tablet's own screens, moved out of apps.ts once that file grew past its limit. */
import { dealerSignIn, endOfDown, handEntry, pairing, queue, seats } from './devices.ts';
import { highHand } from './highHands.ts';

export const tabletApp = {
  /** The table name in the header before the tablet is assigned to a table. */
  unassignedTable: 'Not assigned',
  title: 'Dealer tablet',
  /** The header of a tablet in the practice venue, where dealers train (#50): `{table}` is its table. */
  practiceTable: '{table}, practice venue',
  pairing,
  handEntry,
  dealerSignIn,
  endOfDown,
  queue,
  seats,
  highHand,
} as const;
