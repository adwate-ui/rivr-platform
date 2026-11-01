/** The console's floor screens: the live floor (#77) and the door's Check-in (#72). */

/** The door's Check-in (#72), as in the prototype. */
export const checkIn = {
  title: 'Check-in',
  expected: 'Expected',
  inRoom: 'In the room',
  checkIn: 'Check in',
  /** Check in's name for a screen reader, beside one expected member. */
  checkInMember: 'Check in {name}',
  phone: 'Mobile number',
  /** The field the door's scanner types the membership card's code into (#71). */
  card: 'Membership card',
  checkInByCard: 'Check in by card',
  noneExpected: 'No one expected.',
  noneInRoom: 'No one in the room yet.',
  notAllowed: 'Your role does not check members in or out. The front desk, floor managers and admins do.',
  invalid: 'Enter a 10-digit mobile number.',
  noMember: 'No member has that number. Sign them up first.',
  cardNotCurrent: 'That card code has changed. Ask the member to show their card again.',
  cardInvalid: 'No card code. Scan the member\'s card.',
  /** Check-out at the door (#82): the visit closes, with its hours; points are given by hand (#629). */
  checkOut: 'Check out',
  checkOutMember: 'Check out {name}',
  checkedOut: 'Checked out. Their hours are counted.',
  notInRoom: 'This member is not checked in, so there is no visit to close.',
  callTimeOwed: 'Call time not complete: {time} short. An admin can let them leave early on the Live floor.',
  stillSeated: 'This member is still seated. The floor ends their seat, or the cage cashes them out, before they check out.',
  checkOutPaused: 'The venue is frozen. Members are checked out again once it is released.',
  onBreak: 'This member is on a break from play. They cannot be checked in until it ends.',
  stopped: 'This member is frozen. Ask a manager.',
  paused: 'The venue is frozen. Members are checked in again once it is released.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

/** The live floor (#77, #81): the room plan, the seat map, seating and moves, as in the prototype. */
export const liveFloor = {
  title: 'Live floor',
  empty: 'No tables are running.',
  /** A phone's way from a table back to the plan, and the desk's line while none is chosen (#605). */
  backToFloor: 'Back to the floor',
  chooseTable: 'Choose a table to see its seats and hands.',
  table: 'Table',
  /** The tables, room by room, read out as one part of the screen. */
  roomPlan: 'Room plan',
  seatedCount: '{count} seated',
  mainRoom: 'Main room',
  privateRoom: 'Private Room',
  /** Under a table's ring: hands in the last hour. */
  handsPerHour: '{count} hands/hr',
  noPace: '-',
  noDealer: 'No dealer',
  dealer: 'Dealer · {name}',
  hands: 'Hands',
  perHour: 'Per hour',
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
  /** An empty seat at a closed table. */
  seatFree: 'Open',
  /** A seat held for a member called from the waitlist (#63). */
  heldFor: 'Held for {name}',
  /** The same seat on a table's ring. */
  heldMark: 'H',
  /** At a must-move table: the player's turn to move up, 1 first. */
  mustMove: 'Must move {order}',
  /** A player away from the table, the seat kept (#59). */
  away: 'Away',
  /** The floor marks a player away from the table, or back, as the tablet does (#630). */
  markAway: 'Away',
  markAwayName: '{name} is away from the table',
  markBack: 'Back',
  markBackName: '{name} is back at the table',
  move: 'Move',
  moveName: 'Move {name}',
  moveTitle: 'Move {name}',
  leave: 'Leave',
  leaveName: '{name} leaves',
  /** An admin lets a player leave before their call time, with a reason (#79). `{time}`: 1 h 12 min. */
  leaveEarly: 'Leave early',
  leaveEarlyName: 'Let {name} leave early',
  leaveEarlyTitle: 'Early departure for {name}',
  leaveEarlyOwed: '{time} of call time still owed.',
  leaveEarlyReason: 'Why they leave early',
  leaveEarlyHint: 'Kept on their record, with your name.',
  letLeaveEarly: 'Let leave early',
  leftEarly: 'Early departure recorded. They can leave their seat.',
  callTimeDone: 'Their call time is complete. They can leave.',
  /** Members still in the room who left their seat before its call time. `{time}`: 45 min. */
  leftOwingTitle: 'Left before call time',
  leftOwingLine: '{table} · {time} owed',
  /** A player who is up and wants to go tells the floor, which marks them leaving (decision 0163). */
  leaving: 'Leaving',
  markLeaving: 'Leaving',
  markLeavingName: '{name} is leaving',
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
  callTimeHint: 'Three hours is 180. Zero means no call time.',
  saveCallTime: 'Save call time',
  callTimeInvalid: 'Enter whole minutes from 0 to 1,440.',
  /** Tonight's top-up requests by table (#639), with how long each took. `{time}`: 4 min. */
  topUpsTitle: 'Top-ups tonight',
  noTopUps: 'No top-ups asked for tonight.',
  topUpLine: '{table}, seat {seat} · {name}',
  topUpStatus: { requested: 'Requested', in_progress: 'In progress', fulfilled: 'Fulfilled in {time}', reset: 'Reset', left: 'Left before it was done' },
  /** A seated player's top-up (#634): asked for from the app, then in hand; the floor resets it once done. No amount. */
  topUpRequested: 'Top-up requested',
  topUpInProgress: 'Top-up in progress',
  startTopUp: 'Start top-up',
  startTopUpName: 'The top-up for {name} is in progress',
  resetTopUp: 'Reset top-up',
  resetTopUpName: 'Reset the top-up for {name}',
  seatPlayer: 'Seat a player',
  seatNumber: 'Seat',
  phone: 'Mobile number',
  seat: 'Seat',
  invalidPhone: 'Enter a 10-digit mobile number.',
  openTable: 'Open table',
  closeTable: 'Close table',
  mustMoveTo: 'Must move to',
  ownTable: 'None',
  notAllowed: 'Your role does not seat players or change tables.',
  occupied: 'Someone sits in that seat.',
  held: 'That seat is held for a member called from the waitlist.',
  seated: 'This player is already seated. Move them instead.',
  tableInUse: 'Move the players, and any called to a seat here, before closing the table.',
  mustMoveInvalid: 'A must-move table feeds an open main table of the same game.',
  /** For staff whose role does not read members (#333): the dealer, marketing, the owner's view. */
  noSeatMap: 'Your role does not see the seat map.',
  /** A table's card and ring for a role without the seat map. */
  tableOpen: 'Open',
  ringOpen: '{name}, open',
  kycNeeded: 'This member has not finished their identity check.',
  onBreak: 'This member is on a break from play. They cannot be seated until it ends.',
  noMember: 'No member has that number. Sign them up first.',
  stopped: 'This member is frozen. Ask a manager.',
  paused: 'The venue is frozen. Seating changes again once it is released.',
  invalid: 'That table is closed or has no such seat.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

/** Today's players (#641): every member at the club this club day, for staff who read members. */
export const todaysPlayers = {
  title: 'Today’s players',
  notAllowed: 'Your role does not include members. Ask an admin if you need it.',
  label: 'Players today',
  empty: 'Nobody has come in today yet.',
  filter: 'Find a player',
  name: 'Player',
  status: 'Status',
  statuses: { playing: 'Playing', waiting: 'Waiting', left: 'Left' },
  checkedIn: 'Checked in',
  checkedOut: 'Checked out',
  waited: 'Waited',
  tables: 'Tables and hours',
  /** One table and the time there: `Table 3 · 1 h 20 min`. */
  tableLine: '{table} · {time}',
  none: '–',
} as const;
