/** High hands (#47): the dealer's claim on the tablet, and the console's High hands screen. */

/** On the tablet: the High hand switch on hand entry, which sends a claim to the floor with the hand. */
export const highHand = {
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
  /** The floor set a decided claim aside (#324); the hand may be claimed again. */
  reversed: 'High hand reversed by the floor',
  /** The floor corrected the hand, rank or seat before deciding (#324). */
  corrected: 'Corrected by the floor',
};

/** The console's High hands screen, for staff who approve jackpots or read the ledger. */
export const highHands = {
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
  /** Correcting a waiting claim before deciding it (#324): the dealer's claim is kept. */
  correct: 'Correct',
  correctHand: 'Hand',
  correctRank: 'Rank',
  correctSeat: 'Seat',
  correctConfirm: 'Save the correction',
  invalidCorrection: 'Choose the hand, its rank for a four of a kind, and a seat from 1 to 10.',
  /** `{category}` and `{seat}` are what the dealer claimed. */
  correctedBy: 'Corrected by {name} from {category}, seat {seat}',
  noSeat: 'That table has no such seat.',
  /** Reversing a decided claim (#324): what was paid is posted back, and the hand may be claimed again. */
  reverse: 'Reverse',
  reverseReason: 'Why it is reversed',
  reverseConfirm: 'Reverse the claim',
  reversedBy: 'Reversed by {name}: {reason}',
  /** Also the answer when the staff member dealt the hand themselves. */
  notAllowedAction: 'You cannot decide this claim. Ask a manager who did not deal the hand.',
  decided: 'Someone has just decided this claim. Check the list.',
  changed: 'The payout for this hand has just changed. Check the amount and approve again.',
  paused: 'The venue is frozen. High hands are decided again once it is released.',
  switchedOff: 'Promotions are switched off, so no high hand is paid for now.',
  invalid: 'That claim cannot be paid now. Check the list.',
  unavailable: 'That did not go through. Check the connection and try again.',
};
