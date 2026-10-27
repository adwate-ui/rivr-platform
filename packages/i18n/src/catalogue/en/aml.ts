/** The console's AML register (#105; scope-v1 module 12; decision 0234), for staff who review AML. */
export const aml = {
  title: 'AML register',
  notAllowed: 'Only staff who review AML see the register.',
  intro: 'Patterns in members\' cash in: several visits, or club days, that ended just under the cash limit. Review each with an outcome and a note.',
  tableLabel: 'Register entries',
  empty: 'Nothing to review.',
  member: 'Member',
  pattern: 'Pattern',
  found: 'Found',
  cash: 'Cash in',
  status: 'Status',
  open: 'Open {name}',
  toReview: 'To review',
  memberLine: '{name}, No. {number}',
  kinds: {
    structuring_visit: 'Visits just under the limit',
    structuring_day: 'Club days just under the limit',
  },
  outcomes: {
    no_action: 'No action',
    monitor: 'Monitor',
    reported: 'Reported',
  },
  buyInsLabel: 'Cash in this entry',
  noBuyIns: 'No cash in.',
  what: 'What',
  sources: {
    cage: 'Chips at the cage',
    tournament: 'Tournament entry',
  },
  day: 'Day',
  time: 'Time',
  amount: 'Amount',
  outcome: 'Outcome',
  note: 'Note',
  noteHint: '10 to 1,000 characters: what was checked, and why this outcome. An entry is reviewed once.',
  review: 'Record the review',
  reviewed: 'Reviewed by {name}: {outcome}.',
};

/** Why a review did not go through. */
export const amlFailures = {
  notAllowed: 'Only staff who review AML review the register.',
  invalid: 'Choose an outcome and write a note of 10 to 1,000 characters.',
  paused: 'The venue is frozen. Release it, then review.',
  unavailable: 'The review did not go through. Check the connection and try again.',
};
