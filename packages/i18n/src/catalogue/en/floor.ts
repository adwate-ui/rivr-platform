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
  noneExpected: 'No one expected.',
  noneInRoom: 'No one in the room yet.',
  notAllowed: 'Your role does not check members in. The front desk, floor managers and admins do.',
  invalid: 'Enter a 10-digit mobile number.',
  noMember: 'No member has that number. Sign them up first.',
  onBreak: 'This member is on a break from play. They cannot be checked in until it ends.',
  stopped: 'This member is frozen. Ask a manager.',
  paused: 'The venue is frozen. Members are checked in again once it is released.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

/** The live floor (#77, #81): the room plan, the seat map, seating and moves, as in the prototype. */
export const liveFloor = {
  title: 'Live floor',
  empty: 'No tables are running.',
  table: 'Table',
  /** The tables, room by room, read out as one part of the screen. */
  roomPlan: 'Room plan',
  rakeTonight: 'Rake tonight',
  seatedCount: '{count} seated',
  mainRoom: 'Main room',
  privateRoom: 'Private Room',
  /** Under a table's ring: hands in the last hour. */
  handsPerHour: '{count} hands/hr',
  noPace: '-',
  noDealer: 'No dealer',
  dealer: 'Dealer · {name}',
  /** Under the chosen table's name: `100/200 · buy-in ₹10,000 · rake 5%, cap ₹6,000`. */
  tableLine: '{stakes} · buy-in {buyIn} · rake {rate}%, cap {cap}',
  tableLineNoRake: '{stakes} · buy-in {buyIn}',
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
  move: 'Move',
  moveName: 'Move {name}',
  moveTitle: 'Move {name}',
  leave: 'Leave',
  leaveName: '{name} leaves',
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
  seated: 'This player is already seated. Move them instead; a table with players stays open.',
  kycNeeded: 'This member has not finished their identity check.',
  onBreak: 'This member is on a break from play. They cannot be seated until it ends.',
  noMember: 'No member has that number. Sign them up first.',
  stopped: 'This member is frozen. Ask a manager.',
  paused: 'The venue is frozen. Seating changes again once it is released.',
  invalid: 'That table is closed or has no such seat.',
  unavailable: 'That did not go through. Check the connection and try again.',
};
