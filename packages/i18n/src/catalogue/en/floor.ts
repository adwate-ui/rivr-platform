/** The console's floor screens: the live floor (#77), today's players, tables setup and games history. */

/** The live floor (#77, #81): the room plan, the seat map, seating and moves, as in the prototype. */
export const liveFloor = {
  title: 'Live floor',
  empty: 'No tables are running.',
  /** A phone's way from a table back to the plan (#605). */
  backToFloor: 'Back to the floor',
  table: 'Table',
  /** The tables, room by room, read out as one part of the screen. */
  roomPlan: 'Room plan',
  seatedCount: '{count} seated',
  mainRoom: 'Main room',
  privateRoom: 'Private Room',
  noDealer: 'No dealer',
  dealer: 'Dealer · {name}',
  /** The chosen table's players still owing call time, and asking for a top-up (UI polish audit A-11). */
  callTimeRunning: 'Call time running',
  topUpsWaiting: 'Top-ups waiting',
  recentHands: 'Recent hands',
  noHands: 'No hands yet tonight.',
  handNumber: '#{number}',
  /** A recent hand: `₹18,400 · Hold'em`. */
  handPot: '{pot} · {variant}',
  holdem: 'Hold\'em',
  plo: 'PLO',
  bombPot: 'Bomb pot',
  /** Under a table's seat ring. */
  seatsTaken: '{taken} of {seats}',
  ringLabel: '{name}, {taken} of {seats} seats taken',
  ringClosed: '{name}, closed',
  closed: 'Closed',
  seatOpen: 'Open · call the waitlist',
  /** An empty seat at a closed table: not Open, which reads as one to fill (C-08). */
  seatFree: 'Empty',
  /** A seat held for a member called from the waitlist (#63). */
  heldFor: 'Held for {name}',
  /** Seat on a held seat did not go through (decision 0302): the waitlist says why. */
  heldSeatRefused: 'Not seated. Open the waitlist to see why.',
  heldSeatLate: 'The hold ran out. Assign them again from the waitlist.',
  /** The same seat on a table's ring. */
  heldMark: 'H',
  /** A seated player's row (decision 0299): since when they play, and that no call time was given. `{time}`: 21:40. */
  playingSince: 'Playing since {time}',
  noCallTime: 'No call time',
  /** At a must-move table: the player's turn to move up, 1 first. */
  mustMove: 'Must move {order}',
  /** A player away from the table, the seat kept (#59). */
  away: 'Away',
  leave: 'Leave',
  leaveName: '{name} leaves',
  /** Leave on the Leaving list (decision 0306), named apart from the seat row's own Leave. */
  leavingLeaveName: 'Let {name} go from the leaving list',
  confirmLeave: 'Yes, {name} leaves',
  /** An admin lets a player leave before their call time, with a reason (#79). `{time}`: 1 h 12 min. */
  leaveEarly: 'Leave early',
  leaveEarlyName: 'Let {name} leave early',
  leaveEarlyTitle: 'Early departure for {name}',
  leaveEarlyOwed: '{time} call time owed.',
  leaveEarlyReason: 'Why they leave early',
  leaveEarlyHint: 'Recorded with your name.',
  letLeaveEarly: 'Let leave early',
  /** The single Leave's other way (decision 0299): the seat freed, the call time still owed at the cage. */
  leaveOwing: 'Leave owing',
  leftEarly: 'Released early.',
  callTimeDone: 'Call time done.',
  /** Members still in the room who left their seat before its call time. `{time}`: 45 min. */
  leftOwingTitle: 'Left before call time',
  leftOwingLine: '{table} · {time} call time owed',
  /** A player who is up and wants to go tells the floor, which marks them leaving (decision 0163). */
  leaving: 'Leaving',
  notLeaving: 'Not leaving',
  notLeavingName: '{name} is not leaving',
  /** The Live floor's list of players marked leaving, soonest seat first. `{table}` and `{seat}`: Table 3, 5. */
  leavingTitle: 'Leaving',
  leavingLine: '{table} · seat {seat}',
  leavingNoCallTime: 'No call time here',
  /** Joins from the app waiting for the floor (#633, #638): they are approved on the Waitlist. */
  requestsWaiting: '{count} asking to join a game.',
  oneRequestWaiting: '1 asking to join a game.',
  openWaitlist: 'Approve on the Waitlist',
  /** The floor changes a seated player's call time (#638), in minutes from when they sat down; 0 for none. */
  changeCallTime: 'Call time',
  changeCallTimeName: 'Change the call time of {name}',
  callTimeMinutes: 'Call time in minutes, from when they sat down',
  callTimeHint: 'Minutes. 0 for none.',
  saveCallTime: 'Save call time',
  callTimeInvalid: 'Enter whole minutes, up to 24 h.',
  /** A seated player's top-up (#634): asked for from the app, then in hand; handled on Top-ups (decision 0299). No amount. */
  topUpRequested: 'Top-up requested',
  topUpInProgress: 'Top-up in progress',
  /** The floor's managers add a length the club offers themselves (decision 0305): `Add time` `+1 h` `+2 h`. */
  addTime: 'Add time',
  addTimeChoice: '+{time}',
  addTimeName: 'Add {time} to the call time of {name}',
  /** A table's red marker on the room plan while a top-up waits there (decision 0299). */
  topUpMarker: 'Top-up',
  /** A table's marker while a member there asks for more call time (decision 0320): minutes are on the seat's row. */
  timeMarker: 'Time asked',
  seatPlayer: 'Seat a player',
  seatNumber: 'Seat',
  /** Seating (decision 0299): ten digits are a mobile number, fewer a membership number. */
  phone: 'Mobile or member number',
  seat: 'Seat',
  invalidPhone: 'Enter a 10-digit mobile number or a member number.',
  /** Seating refused: a custom call time out of range. */
  invalidCallTime: 'Give a call time of 0 to 1,440 minutes.',
  openTable: 'Open table',
  closeTable: 'Close table',
  mustMoveTo: 'Must move to',
  ownTable: 'None',
  notAllowed: 'Not in your role. Ask an admin.',
  occupied: 'Someone sits in that seat.',
  held: 'Held for a called member.',
  seated: 'Already seated. Assign them from the waitlist to change tables.',
  tableInUse: 'Move the players and called members first.',
  mustMoveInvalid: 'A must-move table needs an open main table of its game.',
  /** Bonus chips redeemed with the seat (decision 0504), refused: not seated. */
  bonusShort: 'More Bonus than the member has. Not seated.',
  /** Past what the visit may redeem (decision 0579): the seat sheet says how much is left. */
  visitCap: 'More Bonus than this visit allows. Not seated.',
  /** This seating's Bonus was already redeemed with another amount (#1101). */
  bonusRedeemed: 'Bonus was already redeemed for this seat. Not seated.',
  notChips: 'Bonus goes in whole 50s. Not seated.',
  ownRecord: 'You cannot use your own Bonus. Ask another member of staff.',
  bonusOff: 'Promotions are switched off, so no Bonus. Not seated.',
  tooMany: 'Bonus used too often this minute. Wait a moment.',
  /** For staff whose role does not read members (#333): the dealer, marketing, the owner's view. */
  noSeatMap: 'Your role does not see the seat map.',
  /** A table's card and ring for a role without the seat map. */
  tableOpen: 'Open',
  ringOpen: '{name}, open',
  /** Started, waiting for review, refused or under age: the front desk sees which, and checks in person (C-08). */
  kycNeeded: 'This member has not finished their ID check. Send them to the front desk.',
  onBreak: 'This member is on a break from play. Not seated.',
  noMember: 'No member has that number. Sign them up first.',
  stopped: 'This member is frozen. Ask a manager.',
  paused: 'Venue frozen. Try again once it is released.',
  invalid: 'That table is closed or has no such seat.',
  unavailable: 'Not sent. Try again.',
};

/** Today's players (#641): every member at the club this club day, for staff who read members. */
export const todaysPlayers = {
  title: 'Today’s players',
  notAllowed: 'Not in your role. Ask an admin.',
  label: 'Players today',
  empty: 'Nobody has come in today yet.',
  /** The status filter's chips (console v3), each with its count. */
  all: 'All',
  noneOfStatus: 'No player with this status.',
  filter: 'Find a player',
  name: 'Player',
  status: 'Status',
  /** `expected`: on a waitlist and not yet at the door (redesign RD-30). */
  statuses: { playing: 'Playing', waiting: 'Waiting', in_room: 'In the room', expected: 'Expected', left: 'Left', never_arrived: 'Never arrived' },
  /** When they checked in and out, short as the prototype's headers, so a phone's scrolling line keeps them on one line. */
  checkedIn: 'In',
  checkedOut: 'Out',
  /** Short, so every heading fits at 1440 px (the owner, 19 Nov). */
  waited: 'Wait',
  /** The tables a player played on today, and the time played across them, in columns of their own (console v3). */
  table: 'Table',
  played: 'Played',
  /**
   * A row is a seat (the owner, 19 Nov): its time at the table, from when they sat to when they left, open while they are
   * there; and its time away (Players visits). `{from}`, `{to}`: 17:53, 18:43.
   */
  atTable: 'At table',
  atTableSpan: '{from}–{to}',
  atTableOpen: '{from}–',
  away: 'Away',
  /**
   * Bonus a row a seat (the owner, 19 Nov): what the member was given that club day (#1062), by hand or by promotions, on
   * the first row of their latest visit alone; and beside it what they used of their Bonus at each seat, on its row. Short, to fit at 1440 px.
   */
  bonus: 'Bonus',
  bonusUsed: 'Used',
  /** Floor and up (#1073): the member's History in a panel at the side, beside their mobile (console.members.mobile). */
  history: 'History',
  historyOf: 'History of {name}',
  none: '–',
} as const;

/** Top-ups (decision 0299): the requests waiting, each with its wait against the minute, then tonight's closed ones. */
export const topUps = {
  title: 'Top-ups',
  waiting: 'Waiting',
  noneWaiting: 'No top-ups waiting.',
  earlier: 'Earlier tonight',
  noneEarlier: 'None yet tonight.',
  /** `{table}, seat {seat} · {name}`: Table 3, seat 5 · Kabir Sethi. `{time}`: 21:40. */
  line: '{table}, seat {seat} · {name}',
  /** line before the member's name, which follows as its link. */
  lineWhere: '{table}, seat {seat} · ',
  askedAt: 'Asked {time}',
  status: { requested: 'Asked', in_progress: 'In progress', fulfilled: 'Fulfilled in {time}', reset: 'Reset', left: 'Left before it was done' },
  /** Who took each step and how long it took (redesign RD-32): under a request in hand or done. `{time}` is minutes and seconds, `1:20`. */
  acceptedBy: 'Accepted by {name} in {time}',
  doneBy: 'Done by {name} in {time}',
  /** Past requests, a club day at a time. */
  past: 'By day',
  /** An empty cell: a step nobody took. */
  none: '–',
  day: 'Day',
  pastLabel: 'Top-ups of the day',
  nonePast: 'No top-ups that day.',
  columns: { where: 'Table and seat', member: 'Member', asked: 'Asked', acceptedBy: 'Accepted by', accepted: 'Asked to accepted', doneBy: 'Done by', done: 'Accepted to done', status: 'Status' },
  where: '{table}, seat {seat}',
  statusShort: { requested: 'Asked', in_progress: 'In progress', fulfilled: 'Done', reset: 'Reset', left: 'Left before it was done' },
  start: 'Start',
  startName: 'The top-up for {name} is in progress',
  done: 'Done',
  doneName: 'The top-up for {name} is done',
  reset: 'Reset',
  resetName: 'Reset the top-up for {name}',
  notAllowed: 'Not in your role. Ask an admin.',
  failures: {
    paused: 'Venue frozen. Try again once it is released.',
    not_allowed: 'Not in your role. Ask an admin.',
    changed: 'This top-up changed. Check the list and try again.',
  },
} as const;

