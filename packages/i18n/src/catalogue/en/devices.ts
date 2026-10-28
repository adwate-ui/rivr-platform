/** Dealer tablets (#41): the console's Tablets screen, and pairing on the tablet itself. */

/** The console's Tablets screen, for staff who manage devices. */
/** Devices (#606): the tablets, TVs, computers and cameras, by tab. */
export const devices = {
  title: 'Devices',
};

export const tablets = {
  title: 'Tablets',
  notAllowed: 'Your role does not include tablets. Ask an admin if you need it.',
  empty: 'No dealer tablets yet. Add one to pair it.',
  name: 'Tablet name',
  nameHint: 'For example, Table 3 tablet.',
  add: 'Add and pair',
  /** The tablet was added, but its pairing code could not be made. */
  addedWithoutCode: 'Tablet added, but no code was made. Press New pairing code on its row.',
  /** The tablet has signed in with its code. */
  paired: 'Paired',
  notPaired: 'Not paired',
  /** The code to type on the tablet: `{time}` is when it stops working (IST). */
  code: 'Pairing code {code} · enter it on the tablet by {time}',
  newCode: 'New pairing code for {name}',
  table: 'Table for {name}',
  /** A door kiosk (decision 0164): a tablet at the door that scans members' cards in and out. */
  isDoor: 'Door kiosk',
  isDoorHint: 'Scans a member’s card in and out at the door, and is fixed to no table.',
  doorKiosk: 'Door kiosk',
  revoke: 'Revoke {name}',
  revokeReason: 'Why it is revoked',
  revokeConfirm: 'Revoke the tablet',
  invalidName: 'Give the tablet a name.',
  invalidReason: 'Say why the tablet is revoked.',
  notAllowedAction: 'Your role does not allow this.',
  paused: 'The venue is frozen. Tablets change again once it is released.',
  changed: 'That tablet or table has just changed. Check the list and try again.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

/** The tablet before it is paired: a floor manager reads out a code from the console. */
export const pairing = {
  title: 'Tablet pairing',
  /** In the header until the tablet is paired. */
  notPaired: 'Not paired',
  intro: 'A floor manager adds this tablet on the console and reads out a six-digit code. Enter it here.',
  code: 'Pairing code',
  pair: 'Pair',
  wrongCode: 'That code is not right or has run out. Ask for a new one.',
  tooMany: 'Too many wrong codes. Wait ten minutes, then ask for a new code.',
  unavailable: 'Pairing did not go through. Check the connection and try again.',
};

/** The tablet's Hand entry screen (#42): during a down, the dealer types the pot and logs the hand. */
export const handEntry = {
  title: 'Hand entry',
  empty: 'This tablet is not assigned to a table. Ask a floor manager to fix it to one on the console.',
  noRake: 'No rake is set for this table\'s game. Ask a floor manager to set one on the console.',
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
  notAllowed: 'Your role does not set dealer PINs. Ask the owner or the general manager.',
  empty: 'No dealers whose PIN you can set. Only staff whose role includes everything a dealer does, such as the owner or the general manager, set one.',
  hasPin: 'PIN set',
  noPin: 'No PIN yet',
  /** Five wrong PINs on a tablet lock a dealer's PIN: `{time}` is when the lock ends (IST). */
  locked: 'Locked until {time} after five wrong PINs. A new PIN clears the lock.',
  pin: 'New PIN for {name}',
  pinHint: 'Four digits, not all the same. Tell the dealer in person.',
  save: 'Save PIN for {name}',
  saved: 'PIN saved for {name}.',
  invalid: 'A PIN is four digits, not all the same.',
  notAllowedAction: 'Your role does not allow this.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

/** The tablet between downs: the dealer picks their name and enters their PIN. */
export const dealerSignIn = {
  title: 'Dealer sign-in',
  who: 'Who is dealing?',
  pinFor: 'PIN for {name}',
  signIn: 'Sign in',
  noDealers: 'No dealers have a PIN yet. The owner or general manager sets them on the console, and they appear here.',
  wrongPin: 'That PIN is not right. {count} tries left before it locks.',
  wrongPinLast: 'That PIN is not right. One try left before it locks.',
  locked: 'Too many wrong PINs. This PIN is locked for 15 minutes, or until the owner or general manager sets a new one.',
  paused: 'The venue is frozen. Dealers sign in again once it is released.',
  unavailable: 'That did not go through. Check the connection and try again.',
  /** In the header during a down: who is dealing, since when (IST). */
  down: '{name} · down since {time}',
  endDown: 'End of down',
  endDownFailed: 'End of down did not go through. Check the connection and press it again.',
};

/** The console's TVs screen (#49): pair a TV by the code it shows, change what it shows, unpair it. */
export const tvs = {
  title: 'TVs',
  /** Window-only pairing (#325): the owner's switch, and Pair a TV for staff who manage devices. */
  windowOnly: 'Pair TVs only after Pair a TV is pressed',
  openWindow: 'Pair a TV',
  windowOpenUntil: 'A TV gets a code until {time}.',
  windowShut: 'TVs get a code only for ten minutes after Pair a TV is pressed.',
  notAllowed: 'Your role does not include TVs. Ask an admin if you need it.',
  empty: 'No TVs yet: type in the code a TV shows to pair it.',
  code: 'Code on the TV',
  codeHint: 'The six digits a TV that is not paired shows.',
  name: 'TV name',
  nameHint: 'For example, Bar TV.',
  mode: 'What it shows',
  /** Above the form: the venue the TV joins, the one the console is on. */
  venue: 'A TV paired here joins {venue}.',
  practiceVenue: 'A TV paired here joins {venue}, the practice venue: it shows training figures, not the club\'s.',
  pair: 'Pair the TV',
  invalidCode: 'Type the six digits the TV shows.',
  invalidName: 'Give the TV a name.',
  /** After pairing: the TV picks up its login and mode on its next ask, within seconds. */
  pairedNow: '{name} is paired. It shows its mode within a few seconds.',
  wrongCode: 'No TV is showing that code. Check the code on the TV and type it again.',
  /** The TV has signed in. */
  paired: 'Paired',
  /** Paired on the console, but the TV has not picked up its login yet. */
  waiting: 'Waiting for the TV',
  modeFor: 'What {name} shows',
  /** The boards a TV turns to after its main one (decision 0163). */
  rotationFor: 'What {name} turns to in between',
  rotationHint: 'Each board shows for half a minute; promotions show one after another.',
  unpair: 'Unpair {name}',
  unpairReason: 'Why it is unpaired',
  unpairConfirm: 'Unpair the TV',
  invalidReason: 'Say why the TV is unpaired.',
  notAllowedAction: 'Your role does not allow this.',
  paused: 'The venue is frozen. TVs change again once it is released.',
  changed: 'That TV has just changed. Check the list and try again.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

/** A TV before it is paired (#49): the code staff type into the console. */
export const tvPairing = {
  title: 'Screen pairing',
  intro: 'On the console, open TVs and type in this code.',
  /** `{time}` (IST) is when the code runs out and a new one shows. */
  changes: 'The code changes at {time}.',
  loading: 'Getting a code.',
  tooMany: 'Too many screens asked for a code. This one asks again in a minute.',
  /** The venue pairs TVs only after staff press Pair a TV (#325). */
  windowClosed: 'Press Pair a TV under TVs on the console\u2019s Devices screen. This screen shows its code within a minute after.',
  unavailable: 'RIVR cannot be reached. This screen tries again in a minute.',
};

/** A paired TV that cannot read what it shows. */
export const tvScreen = {
  unavailable: 'RIVR cannot be reached. This screen tries again in a few seconds.',
};

/** The final-table stream's overlay for OBS (#125, decision 0256). */
export const streamOverlay = {
  title: 'Stream overlay',
  /** The overlay's address has no hole-card delay, or one it does not take. */
  noDelay: 'This address has no hole-card delay. Add it in seconds, up to 3,600: /overlay?delay=900 holds the clock 15 minutes behind the table, and /overlay?delay=0 shows it live when OBS delays the whole stream.',
  /** The overlay was paired at the practice venue, which never reaches anyone outside the club. */
  practice: 'This overlay is paired at the practice venue, which never reaches a stream. Unpair it on the console, reload it in OBS, and pair it at the club.',
  /** Paired, but given another mode than the tournament clock (#559): said at once, not after the delay. */
  notClock: 'This overlay is paired, but not on the tournament clock. Under TVs on the console\u2019s Devices screen, choose Tournament clock for it.',
  /** For a screen reader only, until the delay has passed since the overlay opened. `{seconds}` is the delay. */
  waiting: 'The clock shows {seconds} seconds behind the table. It starts once that delay has passed.',
};

/** End of down on the tablet (#44): the drop-box count, and what the down closed with. */
export const endOfDown = {
  title: 'End of down',
  intro: 'Count the drop box and enter what it holds. An empty box is nothing entered.',
  /** The keypad's name. */
  count: 'Drop box',
  close: 'Close the down',
  /** `{amount}` is the count typed, which is not whole ₹50 chips (or is above ₹1 crore). */
  notChips: 'A count is whole ₹50 chips, up to ₹1 crore. {amount} is not.',
  /** Above the next dealer's sign-in: the count, the rake and drops logged in the down, and the count less logged. */
  summary: 'Last down: drop box {box}, logged {logged}, variance {variance}.',
  /** While hands wait on the tablet (#43): the down's count must include them. */
  queuedOne: 'Reconnect to send 1 queued hand before hand-over.',
  queued: 'Reconnect to send {count} queued hands before hand-over.',
};

/** The table's seats on the tablet (#59), as in the prototype. */
export const seats = {
  /** The ring, read out. */
  ring: 'Seats at {table}',
  title: 'Seat {seat} · {name}',
  open: 'Seat {seat} is open.',
  buyIn: 'Buy-in',
  requestBuyIn: 'Request buy-in',
  /** While a request for the seat waits at the cage: `{amount}` is how much. */
  withCage: 'Buy-in {amount} with the cage.',
  pending: 'A buy-in for this seat is already with the cage.',
  away: 'Away',
  back: 'Back',
  isAway: 'Away from the table. The seat is kept.',
  left: 'Player left',
  notAllowed: 'This tablet changes only its own table.',
  invalid: 'That player is no longer at the table.',
  paused: 'The venue is frozen. Seats change again once it is released.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

/** The tablet's queue of hands (#43), in its slim banner. */
export const queue = {
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
  notAllowed: 'Your role does not include computers. Ask an admin if you need it.',
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
  paused: 'The venue is frozen. Computers are enrolled again once it is released.',
  unavailable: 'That did not go through. Check the connection and try again.',
};
