/** The dealer tablet's own screens, moved out of apps.ts once that file grew past its limit. */
import { dealerSignIn, endOfDown, handEntry, pairing, queue, seats } from './devices.ts';
import { tabletFnb } from './fnb.ts';

export const tabletApp = {
  /** Ordering food and drink for a seat (#123). */
  fnb: tabletFnb,
  /** The table name in the header before the tablet is assigned to a table. */
  unassignedTable: 'Not assigned',
  title: 'Dealer tablet',
  /** The header and title until the device is known, and always on a door kiosk: a member may be reading it (F-144, F-145). */
  neutralTitle: 'RIVR',
  /** The header of a tablet in the practice venue, where dealers train (#50): `{table}` is its table. */
  practiceTable: '{table}, practice venue',
  pairing,
  handEntry,
  dealerSignIn,
  endOfDown,
  queue,
  seats,
  /** The page the APK shows when the tablet starts before the network is up (#292). */
  offlineStart: {
    title: 'No network',
    body: 'Opens when the club network is back.',
    retry: 'Retry',
  },
} as const;
