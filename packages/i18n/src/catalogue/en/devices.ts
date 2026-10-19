/** Dealer tablets (#41): the console's Tablets screen, and pairing on the tablet itself. */

/** The console's Tablets screen, for staff who manage devices. */
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
  title: 'Pair this tablet',
  /** In the header until the tablet is paired. */
  notPaired: 'Not paired',
  intro: 'A floor manager adds this tablet on the console and reads out a six-digit code. Enter it here.',
  code: 'Pairing code',
  pair: 'Pair',
  wrongCode: 'That code is not right or has run out. Ask for a new one.',
  tooMany: 'Too many wrong codes. Wait ten minutes, then ask for a new code.',
  unavailable: 'Pairing did not go through. Check the connection and try again.',
};

/** The tablet's Hand entry screen, until #42 builds it. */
export const handEntry = {
  title: 'Hand entry',
  empty: 'This tablet is not assigned to a table. Ask a floor manager to fix it to one on the console.',
  /** A dealer is signed in; the keypad and Log hand come with #42. */
  ready: 'Hands for this down are logged here.',
};

/** The console's Dealer PINs screen (#41): for staff whose role includes everything a dealer does. */
export const dealerPins = {
  title: 'Dealer PINs',
  notAllowed: 'Your role does not set dealer PINs. Ask the owner or the general manager.',
  empty: 'No dealers whose PIN you can set. Only staff whose role includes everything a dealer does, such as the owner or the general manager, set one.',
  hasPin: 'PIN set',
  noPin: 'No PIN yet',
  /** Five wrong PINs on a tablet lock a dealer's PIN: `{time}` is when it unlocks (IST). */
  locked: 'Locked until {time} after five wrong PINs. A new PIN unlocks it.',
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
  title: 'Sign in to deal',
  who: 'Who is dealing?',
  pinFor: 'PIN for {name}',
  signIn: 'Sign in',
  noDealers: 'No dealers have a PIN yet. The owner or general manager sets them on the console.',
  wrongPin: 'That PIN is not right. {count} tries left before it locks.',
  wrongPinLast: 'That PIN is not right. One try left before it locks.',
  locked: 'Too many wrong PINs. This PIN is locked for 15 minutes, or until the owner or general manager sets a new one.',
  paused: 'The venue is frozen. Dealers sign in again once it is released.',
  unavailable: 'That did not go through. Check the connection and try again.',
  /** In the header during a down: who is dealing, since when (IST). */
  down: '{name} · down since {time}',
  endDown: 'End of down',
};

/** The console's device screens, spread into its catalogue. */
export const consoleDevices = { tablets, dealerPins };

/** The tablet's pairing, sign-in and hand entry copy, spread into its catalogue. */
export const tabletDevices = { pairing, handEntry, dealerSignIn };
