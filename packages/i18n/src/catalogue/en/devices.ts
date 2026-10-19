/** Dealer tablets (#41): the console's Tablets screen, and pairing on the tablet itself. */

/** The console's Tablets screen, for staff who manage devices. */
export const tablets = {
  title: 'Tablets',
  notAllowed: 'Your role does not include tablets. Ask an admin if you need it.',
  empty: 'No dealer tablets yet. Add one to pair it.',
  name: 'Tablet name',
  nameHint: 'For example, Table 3 tablet.',
  add: 'Add and pair',
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
  unavailable: 'Pairing did not go through. Check the connection and try again.',
};

/** The tablet's Hand entry screen, until #42 builds it. */
export const handEntry = {
  title: 'Hand entry',
  empty: 'This tablet is not assigned to a table. Ask a floor manager to fix it to one on the console.',
  /** Fixed to a table, before dealer sign-in exists (#41). */
  ready: 'Hands are logged here once a dealer signs in.',
};
