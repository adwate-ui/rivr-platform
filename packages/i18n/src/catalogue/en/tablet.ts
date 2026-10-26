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
  /** The door kiosk (decision 0164): a member scans their card to check in and out. `{name}` is their first name. */
  door: {
    prompt: 'Hold your RIVR card up to the camera',
    /** The field a card scanner plugged into the kiosk types into, for a screen reader. */
    scanner: 'Card scanner',
    noCamera: 'The camera is not available. Please see the front desk.',
    welcome: 'Welcome, {name}.',
    welcomeDetail: 'You are checked in. Enjoy the game.',
    goodbye: 'Goodbye, {name}.',
    /** `{time}` is 4 h 30 min. */
    goodbyePlayed: '{time} at the tables tonight. See you soon.',
    goodbyeDetail: 'You are checked out. See you soon.',
    notYet: 'Not yet.',
    seated: 'You are still seated. Please cash out at the cage first.',
    /** `{time}` is 25 min. */
    callTimeOwed: 'Your call time has {time} left. Please see the floor.',
    tryAgain: 'Please try again.',
    cardNotCurrent: 'That code has just changed. Hold your card up again.',
    seeFrontDesk: 'Please see the front desk.',
    onBreak: 'You are on a break from play.',
    unavailable: 'Your card could not be read just now.',
    /** A revoked kiosk: its pairing is gone. */
    notPaired: 'This kiosk is no longer paired.',
  },
} as const;
