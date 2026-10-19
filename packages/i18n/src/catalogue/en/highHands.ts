/** High hands (#47): the dealer's claim on the tablet, and the console's High hands screen. */

/** On the tablet: claiming a high hand for a hand of the down. */
const highHand = {
  /** On a hand's row: `{time}` (IST) names the hand. */
  claim: 'High hand for the {time} hand',
  title: 'High hand',
  category: 'Hand',
  seat: 'Seat',
  rank: 'Four of',
  submit: 'Claim',
  /** After claiming: `{category}` is the hand's name, for example Straight flush. */
  claimed: 'High hand claimed: {category}, seat {seat}. The floor approves it on the console.',
  waiting: 'High hand claimed, waiting for the floor',
  approved: 'High hand approved',
  rejected: 'High hand not approved',
  notPaying: 'The club does not pay that hand now. Ask the floor.',
  noSeat: 'This table has no seat {seat}. Check the seat.',
  noDealer: 'The dealer of this down cannot deal now. End the down and sign in again.',
  alreadyClaimed: 'This hand already has a different high-hand claim.',
  paused: 'The venue is frozen. High hands are claimed again once it is released.',
  switchedOff: 'High hands are switched off for now. Ask the floor.',
  unavailable: 'The claim did not go through. Check the connection and press Claim again.',
};

/** The console's High hands screen, for staff who approve jackpots or read the ledger. */
const highHands = {
  title: 'High hands',
  notAllowed: 'Your role does not include high hands. Ask an admin if you need it.',
  empty: 'No high hands claimed yet.',
  waiting: 'Waiting for approval',
  history: 'History',
  /** A claim: `{category}` is the hand's name, `{time}` when it was played (IST). */
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
  notAllowedAction: 'Your role does not allow this, or you dealt this hand: someone else decides it.',
  decided: 'Someone has just decided this claim. Check the list.',
  changed: 'The payout for this hand has just changed. Check the amount and approve again.',
  paused: 'The venue is frozen. High hands are paid again once it is released.',
  switchedOff: 'Promotions are switched off, so no high hand is paid for now.',
  invalid: 'That claim cannot be paid now. Check the list.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

/** The tablet's high-hand copy, spread into its catalogue. */
export const tabletHighHands = { highHand };

/** The console's High hands screen, spread into its catalogue. */
export const consoleHighHands = { highHands };
