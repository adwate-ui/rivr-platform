/** High hands (#47): the dealer's claim on the tablet, and the console's High hands screen. */

/** On the tablet: the High hand switch on hand entry, which sends a claim to the floor with the hand. */
const highHand = {
  toggle: 'High hand',
  toggleHint: 'Sends a claim to the floor with this hand.',
  category: 'Type of hand',
  seat: 'Seat',
  rank: 'Rank',
  pickTypeAndSeat: 'Pick the type of hand and the seat.',
  pickRank: 'Pick the rank of the four of a kind.',
  /** After the hand is logged with its claim, as in the prototype. */
  sent: 'High hand sent to the floor.',
  waiting: 'High hand claimed, waiting for the floor',
  approved: 'High hand approved',
  rejected: 'High hand not approved',
};

/** The console's High hands screen, for staff who approve jackpots or read the ledger. */
const highHands = {
  title: 'High hands',
  notAllowed: 'Your role does not include high hands. Ask an admin if you need it.',
  empty: 'No high hands claimed yet.',
  waiting: 'Waiting for approval',
  history: 'History',
  /** A claim: `{category}` is the hand's name, `{time}` the day and time it was played (IST). */
  claim: '{category}, seat {seat}, {table} · {time} · dealt by {dealer}',
  pays: 'Pays {amount}',
  paysNothing: 'Pays nothing under the high-hand payouts now. Reject it, or ask an admin to set a payout.',
  approve: 'Approve {amount}',
  reject: 'Reject',
  rejectReason: 'Why it is not approved',
  rejectConfirm: 'Reject the claim',
  invalidReason: 'Say why, in at least three characters.',
  approvedBy: 'Paid {amount}, approved by {name}',
  rejectedBy: 'Rejected by {name}: {reason}',
  /** Also the answer when the staff member dealt the hand themselves. */
  notAllowedAction: 'You cannot decide this claim. Ask a manager who did not deal the hand.',
  decided: 'Someone has just decided this claim. Check the list.',
  changed: 'The payout for this hand has just changed. Check the amount and approve again.',
  paused: 'The venue is frozen. High hands are decided again once it is released.',
  switchedOff: 'Promotions are switched off, so no high hand is paid for now.',
  invalid: 'That claim cannot be paid now. Check the list.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

/** The tablet's high-hand copy, spread into its catalogue. */
export const tabletHighHands = { highHand };

/** The console's High hands screen, spread into its catalogue. */
export const consoleHighHands = { highHands };
