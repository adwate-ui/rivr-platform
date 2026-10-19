/** The console's Rake screen (#37): each table type's rake now, and changes from a time, for setting managers. */
export const rake = {
  title: 'Rake',
  notAllowed: 'Your role does not include rake settings. Ask an admin if you need it.',
  empty: 'No table types yet.',
  /** A table type's rule: `{rate}` is a percentage, `{cap}` formatted money. */
  rule: '{rate}% of the pot, cap {cap}',
  noRule: 'No rake set. Hands at this table type are refused until one is.',
  /** A change to come: `{date}` and `{time}` are IST. */
  scheduled: 'From {date}, {time}: {rule}',
  withdraw: 'Withdraw the change from {date}, {time}',
  noChanges: 'No changes to come.',
  /** The form. */
  change: 'Rake change',
  tableType: 'Table type',
  rate: 'Rate (%)',
  rateHint: 'Of the pot, up to 10%. For example 5.',
  cap: 'Cap (₹)',
  capHint: 'Whole ₹50 chips.',
  on: 'From',
  onHint: 'Hands played before then keep the rule they were played under.',
  at: 'At (IST)',
  atHint: '24-hour time, for example 18:00.',
  reason: 'Why it changes',
  save: 'Schedule the change',
  saved: 'Change scheduled.',
  chooseTableType: 'Choose a table type.',
  invalidRate: 'Give a rate up to 10%, with at most two decimals.',
  invalidCap: 'Give a cap in whole ₹50 chips, up to ₹1,00,000.',
  invalidOn: 'Give the date it takes effect.',
  invalidAt: 'Give a 24-hour time, for example 18:00.',
  invalidReason: 'Say why the rake changes.',
  notAllowedAction: 'Your role does not allow this.',
  refused: 'That change was refused. Choose a time that has no change yet for this table type.',
  /** Scheduling or withdrawing a change a minute away or less: a tablet may already have played a hand under it. */
  tooSoon: 'That is too close to now: a hand may already be played under it. Choose a time at least two minutes away, or leave the change in place.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

export const consoleRake = { rake };
