/** Dealer tablets (#41): the console's Tablets screen, and pairing on the tablet itself. */

/** The console's Tablets screen, for staff who manage devices. */
/** Devices (#606): the tablets, TVs, computers and cameras, by tab. */
export const devices = {
  title: 'Devices',
};

export const tablets = {
  title: 'Tablets',
  /** The form to add one (console v3), under the tablets paired. */
  addTitle: 'Add a tablet',
  notAllowed: 'Not in your role. Ask an admin.',
  empty: 'No dealer tablets yet.',
  name: 'Tablet name',
  nameHint: 'For example, Table 3 tablet.',
  add: 'Add and pair',
  /** The tablet was added, but its pairing code could not be made. */
  addedWithoutCode: 'Added without a code. Press New pairing code on its row.',
  /** The tablet has signed in with its code. */
  paired: 'Paired',
  notPaired: 'Not paired',
  /** The code to type on the tablet: `{time}` is when it stops working (IST). */
  code: 'Pairing code {code} · enter it on the tablet by {time}',
  newCode: 'New pairing code for {name}',
  table: 'Table for {name}',
  /** A door kiosk (decision 0164): a tablet at the door that scans members' cards in and out. */
  isDoor: 'Door kiosk',
  isDoorHint: 'Scans members in and out at the door.',
  doorKiosk: 'Door kiosk',
  /** Unpaired, as a TV is (D-05): the word for ending a pairing. */
  revoke: 'Unpair {name}',
  revokeReason: 'Why it is unpaired',
  revokeConfirm: 'Unpair the tablet',
  invalidName: 'Give the tablet a name.',
  invalidReason: 'Say why the tablet is unpaired.',
  notAllowedAction: 'Your role does not allow this.',
  paused: 'Venue frozen. Try again once it is released.',
  changed: 'The list changed. Check it and try again.',
  unavailable: 'Not sent. Try again.',
};

/** The tablet before it is paired: a floor manager reads out a code from the console. */
export const pairing = {
  title: 'Tablet pairing',
  /** In the header until the tablet is paired. */
  notPaired: 'Not paired',
  intro: 'On the console, open Devices, then Tablets, and get a code for this tablet.',
  code: 'Pairing code',
  pair: 'Pair',
  wrongCode: 'Wrong or expired code. Ask for a new one.',
  sixDigits: 'Enter all six digits.',
  tooMany: 'Too many wrong codes. Wait ten minutes.',
  unavailable: 'Not paired. Try again.',
};

/** The tablet's Hand entry screen (#42): during a down, the dealer types the pot and logs the hand. */
export const handEntry = {
  title: 'Hand entry',
  empty: 'Not assigned to a table. Ask a floor manager.',
  pot: 'Pot',
  /** The pot keypad's name. */
  enterPot: 'Enter the pot',
  rake: 'Rake',
  drop: 'Jackpot drop',
  pull: 'Pull',
  /** Under the rake when the cap set it: `{amount}` is the cap. */
  capped: 'Capped at {amount}',
  variant: 'Game',
  holdem: 'Hold\'em',
  plo: 'PLO',
  bombPot: 'Bomb pot',
  /** `{amount}` is the pot typed, which is not whole ₹50 chips (or is above ₹1 crore). */
  notChips: 'A pot is whole ₹50 chips, up to ₹1 crore. {amount} is not.',
  log: 'Log hand',
  handsThisDown: 'Hands this down: {count}',
  lastHands: 'Last hands',
  noHands: 'No hands yet this down.',
  /** One of the last hands, beside its pot: `{time}` (IST) and the game. */
  hand: '{time} · {variant}',
  /** A hand still on the tablet, waiting to reach the database (#43). */
  queuedHand: '{time} · {variant} · queued',
};

/** The console's Dealer PINs screen (#41): for staff whose role includes everything a dealer does. */
export const dealerPins = {
  title: 'Dealer PINs',
  notAllowed: 'Not in your role. Ask an admin.',
  empty: 'No dealers whose PIN you can set.',
  hasPin: 'PIN set',
  noPin: 'No PIN yet',
  /** Five wrong PINs on a tablet lock a dealer's PIN: `{time}` is when the lock ends (IST). */
  locked: 'Locked until {time}. A new PIN clears it.',
  pin: 'New PIN for {name}',
  pinHint: 'Four digits, not all the same. Tell the dealer in person.',
  save: 'Save PIN for {name}',
  saveShort: 'Save',
  saved: 'PIN saved for {name}.',
  /** The PINs as a table (console v3): its columns, and a row's button, which opens the PIN's field under it. */
  dealer: 'Dealer',
  pinColumn: 'PIN',
  set: 'Set PIN',
  change: 'Change',
  setFor: 'Set PIN for {name}',
  changeFor: 'Change PIN for {name}',
  invalid: 'A PIN is four digits, not all the same.',
  notAllowedAction: 'Your role does not allow this.',
  unavailable: 'Not sent. Try again.',
};

/** The tablet between downs: the dealer picks their name and enters their PIN. */
export const dealerSignIn = {
  title: 'Dealer sign-in',
  who: 'Dealers',
  pinFor: 'PIN for {name}',
  signIn: 'Sign in',
  noDealers: 'No dealer PINs yet. They are set on the console.',
  wrongPin: 'Wrong PIN. {count} tries left.',
  wrongPinLast: 'Wrong PIN. One try left.',
  locked: 'PIN locked for 15 minutes, or until a new one is set.',
  paused: 'Venue frozen. Try again once it is released.',
  unavailable: 'Not sent. Try again.',
  /** In the header during a down: who is dealing, since when (IST). */
  down: '{name} · down since {time}',
  endDown: 'End of down',
  endDownFailed: 'End of down not sent. Try again.',
  /** Under a dealer's PIN pad: back to the names (D-04). */
  another: 'Another dealer',
};

/** The console's TVs screen (#49): pair a TV by the code it shows, change what it shows, unpair it. */
export const tvs = {
  title: 'TVs',
  /** The form to pair one (console v3), under the TVs paired. */
  pairTitle: 'Pair a TV',
  /** Window-only pairing (#325): the owner's switch, and Pair a TV for staff who manage devices. */
  windowOnly: 'Pair TVs only after Pair a TV is pressed',
  openWindow: 'Pair a TV',
  windowOpenUntil: 'A TV gets a code until {time}.',
  windowShut: 'Press Pair a TV, then pair within ten minutes.',
  notAllowed: 'Not in your role. Ask an admin.',
  empty: 'No TVs yet.',
  code: 'Code on the TV',
  codeHint: 'The six digits on the TV.',
  name: 'TV name',
  nameHint: 'For example, Bar TV.',
  mode: 'What it shows',
  /** Above the form: the venue the TV joins, the one the console is on. */
  venue: 'A TV paired here joins {venue}.',
  practiceVenue: 'Pairs to {venue}, the practice venue: training figures only.',
  pair: 'Pair the TV',
  invalidCode: 'Type the six digits the TV shows.',
  invalidName: 'Give the TV a name.',
  /** After pairing: the TV picks up its login and mode on its next ask, within seconds. */
  pairedNow: '{name} is paired.',
  wrongCode: 'No TV shows that code. Check it and type it again.',
  /** The TV has signed in. */
  paired: 'Paired',
  /** Paired on the console, but the TV has not picked up its login yet. */
  waiting: 'Waiting for the TV',
  modeFor: 'What {name} shows',
  /** The boards a TV turns to after its main one (decision 0163). */
  rotationFor: 'What {name} turns to in between',
  rotationHint: 'Each board shows for 30 seconds.',
  unpair: 'Unpair {name}',
  unpairReason: 'Why it is unpaired',
  unpairConfirm: 'Unpair the TV',
  invalidReason: 'Say why the TV is unpaired.',
  notAllowedAction: 'Your role does not allow this.',
  paused: 'Venue frozen. Try again once it is released.',
  changed: 'The list changed. Check it and try again.',
  unavailable: 'Not sent. Try again.',
};

/** A TV before it is paired (#49): the code staff type into the console. */
export const tvPairing = {
  title: 'Screen pairing',
  intro: 'On the console, open Devices, then TVs, and type in this code.',
  /** `{time}` (IST) is when the code runs out and a new one shows. */
  changes: 'The code changes at {time}.',
  loading: 'Getting a code.',
  tooMany: 'Too many screens asked. Retrying in a minute.',
  /** The venue pairs TVs only after staff press Pair a TV (#325). */
  windowClosed: 'Press Pair a TV on the console. The code shows within a minute.',
  unavailable: 'No connection. Retrying in a minute.',
};

/** A paired TV that cannot read what it shows. */
export const tvScreen = {
  unavailable: 'No connection. Retrying shortly.',
};

/** The final-table stream's overlay for OBS (#125, decision 0256). */
export const streamOverlay = {
  title: 'Stream overlay',
  /** The overlay's address has no hole-card delay, or one it does not take. */
  noDelay: 'This address has no hole-card delay. Add it in seconds, up to 3,600: /overlay?delay=900 holds the clock 15 minutes behind the table, and /overlay?delay=0 shows it live when OBS delays the whole stream.',
  /** The overlay was paired at the practice venue, which never reaches anyone outside the club. */
  practice: 'This overlay is paired at the practice venue, which never reaches a stream. Unpair it on the console, reload it in OBS, and pair it at the club.',
  /** Paired, but given another mode than the tournament clock (#559): said at once, not after the delay. */
  notClock: 'This overlay shows the tournament clock, which is off while tournaments are hidden.',
  /** For a screen reader only, until the delay has passed since the overlay opened. `{seconds}` is the delay. */
  waiting: 'The clock shows {seconds} seconds behind the table. It starts once that delay has passed.',
};

/** End of down on the tablet (#44): the table handed over, with no drop-box count (#630). */
export const endOfDown = {
  title: 'End of down',
  intro: 'Hand the table over: the down ends and the next dealer signs in.',
  close: 'Close the down',
  /** While hands wait on the tablet (#43): they go first. */
  queuedOne: 'Reconnect to send 1 queued hand before hand-over.',
  queued: 'Reconnect to send {count} queued hands before hand-over.',
};

/** The table's seats on the tablet (#59), as in the prototype. */
export const seats = {
  /** The tablet's screen during a down (#630): the seats, with no hand entry. */
  screen: 'Seats',
  /** The ring, read out. */
  ring: 'Seats at {table}',
  title: 'Seat {seat} · {name}',
  open: 'Seat {seat} is open.',
  pending: 'A buy-in for this seat is already with the cage.',
  away: 'Away',
  /** Under a seat on the ring (F-189): `{minutes}` is the call time left, its last fifteen. */
  leaving: 'Leaving',
  ending: '{minutes} min left',
  back: 'Back',
  isAway: 'Away from the table. The seat is kept.',
  left: 'Player left',
  /** The second press of Player left (B7): `{name}` is the player. */
  confirmLeft: 'Yes, {name} left',
  notAllowed: 'This tablet changes only its own table.',
  invalid: 'That player is no longer at the table.',
  paused: 'Venue frozen. Try again once it is released.',
  unavailable: 'Not sent. Try again.',
};

/** The tablet's queue of hands (#43), in its slim banner. */
export const queue = {
  /** Offline with no hand held (F-045): before the device is known, at a table, at a door kiosk. */
  offline: 'Offline.',
  offlineTable: 'Offline. Seats update when the network is back.',
  offlineDoor: 'Check-in is offline. See the front desk.',
  queuedOne: 'Offline. 1 hand queued.',
  queued: 'Offline. {count} hands queued.',
  sendingOne: 'Sending 1 hand.',
  sending: 'Sending {count} hands.',
  /** Back online, once every hand held offline has reached the database, until the next hand is logged. */
  sentOne: '1 queued hand sent to the floor.',
  sent: '{count} queued hands sent to the floor.',
  refusedOne: '1 hand was refused. Call a floor supervisor.',
  refused: '{count} hands were refused. Call a floor supervisor.',
  /** A claim the database refused for good, its hand logged: promotions off, a seat the table does not have, or another claim on the hand. */
  claimRefused: 'The high-hand claim for seat {seat} was refused. Ask the floor.',
  /** Clears the refusals once the floor has dealt with them. */
  seen: 'Seen by the floor',
};

/** The console's Computers screen (#384): enrol this computer as the cage or an admin console, and revoke one. */
export const computers = {
  title: 'Computers',
  notAllowed: 'Not in your role. Ask an admin.',
  thisComputer: 'This computer',
  enrolledAsCage: 'Enrolled as the cage: {name}.',
  enrolledAsConsole: 'Enrolled as an admin console: {name}.',
  /** Never this browser: the cage agent is a service, not a browser (#168). */
  enrolledAsAgent: 'Enrolled as the cage agent: {name}.',
  notEnrolled: 'Not enrolled. Enter the code an admin console gave for this computer.',
  enrolCode: 'Enrolment code',
  enrol: 'Enrol this computer',
  wrongCode: 'That code is wrong, used or expired. Add the computer again for a new one.',
  tooMany: 'Too many wrong codes. Wait ten minutes, then try again.',
  /** A computer added on Computers whose code has not been entered on it yet. */
  waiting: 'Waiting for its code',
  /** After adding a computer: `{code}` is six digits, `{name}` the computer's, `{time}` when it stops working. */
  code: 'Code {code} for {name}, until {time}. Enter it on that computer, on Computers.',
  /** Shown while the venue has no cage and admin networks (Settings), so nothing is enforced. */
  notEnforced: 'Not enforced yet: the club has no cage and admin networks, so the cage and admin screens work from any computer. Add the networks in Settings.',
  offNetwork: 'This computer is not on the cage and admin networks, so the cage and admin screens refuse it here.',
  name: 'Computer name',
  nameHint: 'For example, Cage 1 or Office.',
  addCage: 'Add as the cage',
  addConsole: 'Add as an admin console',
  /** The cage agent (#168, #123): a service on the cage computer that keeps the offline pack and prints KOTs. */
  addAgent: 'Add the cage agent',
  agentCode: 'Code {code} for {name}, until {time}. Give it to the cage agent: rivr-agent enrol {code}.',
  enrolled: 'Cage and admin computers',
  empty: 'No computers are added.',
  cage: 'Cage',
  console: 'Admin console',
  agent: 'Cage agent',
  revoke: 'Revoke {name}',
  revokeReason: 'Why it is revoked',
  revokeConfirm: 'Revoke',
  invalidReason: 'Say why, in a few words.',
  notAllowedAction: 'Not from here. Computers are added at an enrolled admin console, and enrolled on the club\'s networks.',
  invalid: 'Give the computer a name.',
  paused: 'Venue frozen. Try again once it is released.',
  unavailable: 'Not sent. Try again.',
};
