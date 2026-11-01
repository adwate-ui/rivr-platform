/** The console's floor screens: the live floor (#77), today's players, tables setup and games history. */

/** The live floor (#77, #81): the room plan, the seat map, seating and moves, as in the prototype. */
export const liveFloor = {
  title: 'Live floor',
  empty: 'No tables are running.',
  /** A phone's way from a table back to the plan, and the desk's line while none is chosen (#605). */
  backToFloor: 'Back to the floor',
  chooseTable: 'Choose a table to see its seats.',
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
  confirmLeave: 'Yes, {name} leaves',
  /** An admin lets a player leave before their call time, with a reason (#79). `{time}`: 1 h 12 min. */
  leaveEarly: 'Leave early',
  leaveEarlyName: 'Let {name} leave early',
  leaveEarlyTitle: 'Early departure for {name}',
  leaveEarlyOwed: '{time} of call time still owed.',
  leaveEarlyReason: 'Why they leave early',
  leaveEarlyHint: 'Recorded with your name.',
  letLeaveEarly: 'Let leave early',
  leftEarly: 'Released early.',
  callTimeDone: 'Call time complete.',
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
  callTimeHint: 'Minutes. 0 for none.',
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
  held: 'Held for a called member.',
  seated: 'Already seated. Move them instead.',
  tableInUse: 'Move the players and called members first.',
  mustMoveInvalid: 'A must-move table needs an open main table of its game.',
  /** For staff whose role does not read members (#333): the dealer, marketing, the owner's view. */
  noSeatMap: 'Your role does not see the seat map.',
  /** A table's card and ring for a role without the seat map. */
  tableOpen: 'Open',
  ringOpen: '{name}, open',
  kycNeeded: 'This member has not finished their identity check.',
  onBreak: 'On a break. Seating is closed until it ends.',
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

/** Tables setup (#642): the stakes the club runs and its tables, for the super admin (tables.manage). */
export const tablesSetup = {
  title: 'Tables setup',
  notAllowed: 'Only the super admin sets up tables.',
  stakes: 'Stakes',
  stakesLabel: 'The stakes the club runs',
  stakesEmpty: 'No stakes yet.',
  tables: 'Tables',
  tablesLabel: 'The club’s tables, in floor order',
  tablesEmpty: 'No tables yet.',
  name: 'Name',
  game: 'Game',
  games: { nlh: 'No-limit hold’em', plo: 'Pot-limit Omaha' },
  /** In the stakes' table, where the full name does not fit. */
  gamesShort: { nlh: 'NLH', plo: 'PLO' },
  stakeName: 'Stake name',
  tableName: 'Table name',
  blinds: 'Blinds',
  smallBlind: 'Small blind',
  bigBlind: 'Big blind',
  blindsHint: 'Whole 50s of chips.',
  gameFixed: 'A stake keeps its game.',
  stake: 'Stake',
  seats: 'Seats',
  now: 'Now',
  open: 'Open',
  closed: 'Closed',
  change: 'Change',
  /** A row's Change button for a screen reader, and the form's heading while it changes that one. */
  changeStake: 'Change stake {name}',
  changeTable: 'Change table {name}',
  newStake: 'New stake',
  newTable: 'New table',
  saveStake: 'Save the stake',
  saveTable: 'Save the table',
  /** After a save: `{name}` is the stake or table. */
  saved: '{name} is saved.',
  failures: {
    invalid: 'Check the name, the blinds (whole 50s) and the seats (2 to 10).',
    players_seated: 'Move the players off this table before changing its stake.',
    seats_taken: 'More seats are taken. Free them first.',
    not_allowed: 'Only the super admin sets up tables.',
    paused: 'Venue frozen. Try again once it is released.',
    unavailable: 'Not sent. Try again.',
  },
} as const;

/** Games history (#643): the tables run each club day and the hours each ran, for the super admin (tables.manage). */
export const gamesHistory = {
  title: 'Games history',
  notAllowed: 'Only the super admin reads games history.',
  label: 'Tables run each club day',
  from: 'From',
  to: 'To',
  rangeInvalid: 'Choose a first day on or before the last.',
  day: 'Club day',
  table: 'Table',
  stake: 'Stake',
  /** A stake: `PLO 100/200`. */
  stakeLine: '{game} {blinds}',
  games: { nlh: 'NLH', plo: 'PLO' },
  runs: 'Times opened',
  hours: 'Time run',
  filter: 'Find a table',
  empty: 'No table ran on these days.',
} as const;
