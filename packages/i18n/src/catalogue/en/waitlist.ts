/** Tonight's tables and the waitlist: Home in the player app, and the console's Waitlist. */

/** Home's Tonight: each table with how many wait, Join, and the member's own places. */
export const tonight = {
  title: 'Tonight',
  empty: 'No tables are running.',
  /** How many wait for a table's game and stake. */
  waiting: '{count} waiting',
  noWait: 'No wait',
  closed: 'Closed',
  join: 'Join',
  /** The member is on this game's list: `{place}` is their place, 1 being next. */
  onTheList: '{count} waiting · You are number {place}',
  yourWaitlist: 'Your waitlist',
  /** One of the member's places: `{place}` on the list, joined at `{time}` (IST). */
  place: 'Number {place} · Joined {time}',
  leave: 'Leave',
  kycNeeded: 'Finish your identity check in Profile to join a waitlist.',
  notOpen: 'Joining a waitlist from the app is not open to you. Ask at the front desk.',
  stopped: 'Your account is paused. Speak to the front desk.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

/** The floor's waitlists on the console, one per game and stake. */
export const waitlist = {
  title: 'Waitlist',
  notAllowed: 'Your role does not include the waitlist. Ask an admin if you need it.',
  empty: 'No one is waiting.',
  /** The venue has no tables set up, so no lists. */
  noGames: 'No games are set up at this venue yet.',
  /** One place: `{place}` on the list, `{name}`, joined at `{time}` (IST). */
  entry: '{place}. {name} · {time}',
  /** A place ahead of join time (#40): `{reason}` is the tier, "Black card". */
  entryWithReason: '{place}. {name} · {time} · {reason}',
  addedByFloor: 'Added by the floor',
  remove: 'Remove {name}',
  phone: 'Mobile number',
  add: 'Add to the list',
  noMember: 'No member has that number. Sign them up first.',
  kycNeeded: 'This member has not finished their identity check.',
  stopped: 'This member is frozen.',
  paused: 'The venue is frozen. The waitlist changes again once it is released.',
  invalid: 'Enter a 10-digit mobile number.',
  notOpen: 'Your role does not allow this, or that place is not on this venue\'s lists.',
  unavailable: 'That did not go through. Check the connection and try again.',
};
