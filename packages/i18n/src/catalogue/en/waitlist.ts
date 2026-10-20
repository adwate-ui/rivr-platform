/** Tonight's tables and the waitlist: Home in the player app, and the console's Waitlist. */

/** Home's Tonight: each table with how many wait, Join, and the member's own places. */
export const tonight = {
  /** While a break runs (#56): `{until}` is when it ends, Wed 17 Feb, 00:10. */
  breakActive: 'Break active until {until}. Tables are closed to you until then.',
  /** Seated tonight (#78), with the call time left beneath. */
  seated: 'Seated at {table}, seat {seat}.',
  onBreak: 'Break active. Tables are closed to you until it ends.',
  title: 'Tonight',
  empty: 'No tables are running.',
  /** How many wait for a table's game and stake. */
  waiting: '{count} waiting',
  noWait: 'No wait',
  /** A table's open seats, before how many wait (#87). */
  seatsOpen: '{count} seats open',
  oneSeatOpen: '1 seat open',
  full: 'Full',
  /** Above the tables while the member's identity check is not done (#87). */
  kycIncomplete: 'KYC incomplete. Finish it to join a table.',
  finishKyc: 'Finish identity check',
  /** The bad-beat jackpot at the member's venue (#87). */
  jackpot: 'Bad-beat jackpot',
  nextTournament: 'Next tournament',
  /** When it starts, IST, and its buy-in: `Sun 15 Nov, 16:00 · Buy-in ₹10,000`. */
  tournamentWhen: '{date}, {time} · Buy-in {buyIn}',
  /** The prize pool the club guarantees. */
  guaranteed: '{amount} guaranteed',
  closed: 'Closed',
  join: 'Join',
  /** The member is on this game's list: `{place}` is their place, 1 being next. */
  onTheList: '{count} waiting · You are number {place}',
  yourWaitlist: 'Your waitlist',
  /** One of the member's places: `{place}` on the list, joined at `{time}` (IST). */
  place: 'Number {place} · Joined {time}',
  leave: 'Leave',
  /** The seat call (#63), as the WhatsApp message says it: `{time}` is when the hold runs out, IST. */
  seatReady: 'Your seat is ready. {table}, seat {seat}. Hold expires {time}.',
  stepAway: 'Step away',
  back: "I'm back",
  /** A member who stepped away: `{time}` is when their place goes. */
  away: 'Stepped away. Your place is kept until {time}.',
  tooLate: 'You were away too long, so your place has gone. Join again if you still want to play.',
  noTimeAway: 'You have used all your time away for this place.',
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
  /** Call-down (#63). */
  call: 'Call {name}',
  callTable: 'Table for {name}',
  callSeat: 'Seat',
  callConfirm: 'Call to this seat',
  invalidCall: 'Choose an open table, and a seat at it.',
  seatHeld: 'That seat is held for someone already called. Choose another seat.',
  seatTaken: 'Someone sits in that seat. Choose another seat.',
  tooLate: 'The hold has run out. The place goes to the next name within a minute.',
  noTimeAway: 'This member has used all their time away for this place.',
  /** Call, Seat, Skip or Back refused because someone else changed the place or the table first. */
  changed: 'That place or table has just changed. Check the list and try again.',
  seat: 'Seat {name}',
  skip: 'Skip {name}',
  back: '{name} is back',
  /** A called place: `{time}` is when the hold runs out. */
  called: 'Called to {table}, seat {seat} · hold until {time}',
  /** A place stepped away or skipped: `{time}` is when it goes. */
  away: 'Away · place kept until {time}',
  phone: 'Mobile number',
  add: 'Add to the list',
  noMember: 'No member has that number. Sign them up first.',
  kycNeeded: 'This member has not finished their identity check.',
  onBreak: 'This member is on a break from play. Tables are closed to them until it ends.',
  stopped: 'This member is frozen.',
  paused: 'The venue is frozen. The waitlist changes again once it is released.',
  invalid: 'Enter a 10-digit mobile number.',
  notOpen: 'Your role does not allow this, or that place is not on this venue\'s lists.',
  unavailable: 'That did not go through. Check the connection and try again.',
};
