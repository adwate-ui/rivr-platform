/** Tonight's tables and the waitlist: Home in the player app, and the console's Waitlist. */

/** Home's Tonight: each table with how many wait, Join, and the member's own places. */
export const tonight = {
  /** While a break runs (#56): `{until}` is when it ends, Wed 17 Feb, 00:10. */
  /** `{until}`: 8 Nov 2026, 14:00, with the year, as the floor's break may run for years (A5-14). */
  breakActive: 'On a break until {until}.',
  /** Seated tonight (#78): the seat card's heading, with the call time left beneath. */
  seated: '{table}, seat {seat}',
  /** At the seat (decision 0300): since when the member plays, `21:40`, and for how long, `1 h 20 min`. */
  playingSince: 'Playing since {time} · {played}',
  /** The call time the floor gave, the least the member plays before leaving: `3 h`. */
  minimumSession: 'Minimum session {time}',
  /** An hour more call time, while it runs (#634). */
  extendCallTime: 'Add 1 h',
  /** The same button's full name for a screen reader. */
  extendCallTimeName: 'Add an hour of call time',
  leaveSeat: 'Leave my seat',
  /** Left with call time still owed: the floor's Leaving list shows them until it is done. */
  onLeavingList: 'On the leaving list until your call time ends.',
  requestTopUp: 'Top up',
  topUpRequested: 'Top-up requested.',
  topUpInProgress: 'Top-up in progress at your seat.',
  seatFailures: {
    not_seated: 'You are not seated any more.',
    not_allowed: 'Not open to you. Ask at the front desk.',
    stopped: 'Account paused. Ask at the front desk.',
    paused: 'The club is paused. Try again later.',
    unavailable: 'Not sent. Try again.',
  },
  onBreak: 'On a break.',
  title: 'Tonight',
  tables: 'Tables',
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
  /** The next tournament, then its name and when it starts, IST: `Sun 15 Nov, 16:00`. No buy-in or prize (#627). */
  nextTournament: 'Next tournament',
  /** A tournament running at the club (#119), its level and time left ticking: `RIVR Sunday · Level 8`, `11:32`. */
  liveTournament: 'Tournament',
  liveLevel: '{name} · Level {level}',
  liveBreak: '{name} · Break',
  /** On a break, the level that follows: `Next 500/1,000 ante 1,000`. */
  liveNext: 'Next {blinds}',
  livePaused: 'Paused',
  /** The field (#118): `31 of 58 left`. */
  liveLeft: '{left} of {entries} left',
  /** The member's own standing and what they may buy (#118). */
  seatedAt: 'You are at table {table}, seat {seat}.',
  alternate: 'Alternate. The floor seats you when one opens.',
  bustedOut: 'You are out.',
  offers: { entry: 'Register', re_entry: 'Re-enter', rebuy: 'Rebuy' },
  confirmBuy: 'Pay the buy-in from your balance?',
  payNow: 'Yes, pay',
  notNow: 'Not now',
  /** Why the app did not sell it. */
  buyFailures: {
    short: 'Not enough in your balance.',
    registration_closed: 'Registration has closed.',
    identity: 'Finish your identity check first.',
    on_break: 'On a break: no buy-ins until it ends.',
    switched_off: 'Tournament registration is paused.',
    room_full: 'Every seat is taken. Ask the floor.',
    no_ticket: 'That ticket is used already.',
    other: 'Not sent. Try again or ask the floor.',
  },
  /** Satellite tickets the member holds (#519). */
  tickets: 'Your tournament tickets',
  ticketLine: '{name} · {when}',
  enterWithTicket: 'Enter with your ticket',
  enteredWithTicket: 'You are in {name}.',
  ticketsFailed: 'Your tickets did not load.',
  /** The club's upcoming tournaments (#636): register interest, pay at the club, and the floor marks you registered. */
  upcoming: 'Upcoming tournaments',
  registerInterest: 'Register interest',
  registerInterestName: 'Register interest in {name}',
  standing: { none: 'Not registered', interested: 'Interest registered', registered: 'Registered' },
  payAtTheClub: 'Pay at the club, and the floor registers you.',
  interestFailures: {
    not_allowed: 'Tournament registration is not open to you.',
    invalid: 'That tournament is no longer coming up.',
    paused: 'The club is paused. Try again later.',
    unavailable: 'Not sent. Try again.',
  },
  closed: 'Closed',
  join: 'Join',
  /** Each Join named by its table, for a screen reader (F3-17). */
  joinName: 'Join {table}',
  /** The member is on this game's list: `{place}` is their place, 1 being next. */
  onTheList: '{count} waiting · your place {place}',
  /** The member asked to join this game (#633), and the floor has not approved it yet. */
  requested: '{count} waiting · You asked to join',
  /** A game's call time (#633): `{time}` is `3 h`. */
  callTime: 'Call time {time}',
  yourWaitlist: 'Your waitlist',
  /** One of the member's places: `{place}` on the list, joined at `{time}` (IST). */
  place: 'Number {place} · Joined {time}',
  /** A join the floor has not approved (#633): `{time}` is when the member asked, IST. */
  request: 'Asked at {time} · waiting for the floor',
  leave: 'Leave',
  /** On each of the member's places: `{game}` is the list, `NLH 100/200`. */
  leaveName: 'Leave: the {game} list',
  confirmLeave: 'Yes, leave',
  /** The seat call (#63), as the WhatsApp message says it: `{time}` is when the hold runs out, IST. */
  seatReady: 'Your seat is ready: {table}, seat {seat}. Held until {time}.',
  /** A member who stepped away: `{time}` is when their place goes. */
  away: 'Stepped away. Place held until {time}.',
  tooLate: 'Your time away ran out. Join again to play.',
  noTimeAway: 'You have used all your time away for this place.',
  oneAtATime: 'One list at a time. Leave the other first.',
  kycNeeded: 'Finish your identity check in Profile to join a waitlist.',
  notOpen: 'Ask at the front desk to join.',
  stopped: 'Account paused. Ask at the front desk.',
  unavailable: 'Not sent. Try again.',
};

/** The floor's waitlists on the console, one per game and stake. */
export const waitlist = {
  title: 'Waitlist',
  notAllowed: 'Not in your role. Ask an admin.',
  empty: 'No one is waiting.',
  /** The venue has no tables set up, so no lists. */
  noGames: 'No games are set up at this venue yet.',
  /** A game with no open table (#113, decision 0184): its waitlist is its interest list. */
  interest: 'Not running · {count} interested',
  /** With the venue's number to open a table at. */
  interestShort: 'Not running · {count} interested, a table opens at {needed}',
  interestReady: '{count} interested: enough to open a table',
  openTable: 'Open {table}',
  openFailed: 'Table not opened. Try again.',
  openNotAllowed: 'Not in your role. Ask a floor manager.',
  openPaused: 'Venue frozen. Try again once it is released.',
  /** One place: `{place}` on the list, `{name}`, joined at `{time}` (IST). */
  entry: '{place}. {name} · {time}',
  /** A place ahead of join time (#40): `{reason}` is the tier, "Black card". */
  entryWithReason: '{place}. {name} · {time} · {reason}',
  addedByFloor: 'Added by the floor',
  /** Joins from the app the floor approves onto the list, or removes (#633): `{name}` asked at `{time}` (IST). */
  requests: 'Asking to join',
  requestsFailed: 'Requests not loaded. Reload the page.',
  requestLine: '{name} · asked at {time}',
  approve: 'Approve {name}',
  approveShort: 'Approve',
  removeShort: 'Remove',
  remove: 'Remove {name}',
  confirmRemove: 'Yes, remove {name}',
  /** Assign (decision 0299): the call and the seating in one step, with the call time. */
  call: 'Assign {name}',
  /** The visible label; `call` is its name for a screen reader (UI polish audit A-09). The same for seat, skip and back. */
  callShort: 'Assign',
  callTable: 'Table for {name}',
  callSeat: 'Seat',
  callConfirm: 'Assign',
  invalidCall: 'Choose an open table, a seat at it, and a call time of 0 to 1,440 minutes.',
  seatHeld: 'Held for a called player. Choose another seat.',
  seatTaken: 'Seat taken. Choose another.',
  tooLate: 'Hold expired. The next name is called shortly.',
  noTimeAway: 'No time away left for this place.',
  oneAtATime: 'Already waiting for another game. Remove them from that list first.',
  /** Back refused: the member was away past their time, so the place has gone (#287). */
  awayTooLong: 'Away too long. Add them again if they are here.',
  /** Call, Seat, Skip or Back refused because someone else changed the place or the table first. */
  changed: 'The list changed. Check it and try again.',
  seat: 'Seat {name}',
  seatShort: 'Seat',
  /** Hold place (decision 0299): the member is away; their place is kept for the hold time, the seat goes to the next name. */
  skip: 'Hold place: {name}',
  skipShort: 'Hold place',
  confirmSkip: 'Yes, hold {name}’s place',
  /** Under the list: what Hold place and Remove each do. */
  holdOrRemove: 'Hold place keeps a member’s place while they are away. Remove takes them off the list.',
  back: 'Back: {name}',
  backShort: 'Back',
  /** A called place: `{time}` is when the hold runs out. */
  called: 'Called to {table}, seat {seat} · hold until {time}',
  /** A place stepped away or skipped: `{time}` is when it goes. */
  away: 'Away · place kept until {time}',
  phone: 'Mobile number',
  add: 'Add to the list',
  noMember: 'No member has that number. Sign them up first.',
  kycNeeded: 'This member has not finished their identity check. Send them to the front desk.',
  onBreak: 'This member is on a break.',
  stopped: 'This member is frozen.',
  paused: 'Venue frozen. Try again once it is released.',
  invalid: 'Enter a 10-digit mobile number.',
  notOpen: 'Not allowed here.',
  unavailable: 'Not sent. Try again.',
};
