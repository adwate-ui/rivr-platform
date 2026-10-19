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
  change: 'Change rake',
  changeHint: 'Hands played before the time keep the rule in force when they were played.',
  tableType: 'Table type',
  rate: 'Rate (%)',
  rateHint: 'Of the pot, up to 10%. For example 5.',
  cap: 'Cap (₹)',
  capHint: 'Whole ₹50 chips.',
  on: 'From',
  at: 'At (IST)',
  atHint: '24-hour time, for example 18:00.',
  reason: 'Why it changes',
  save: 'Schedule the change',
  saved: 'Change scheduled.',
  chooseTableType: 'Choose a table type.',
  invalidRate: 'Give a rate up to 10%, with at most two decimals.',
  invalidCap: 'Give a cap in whole ₹50 chips, up to ₹1,00,000.',
  invalidWhen: 'Give a date and a 24-hour time.',
  invalidReason: 'Say why the rake changes.',
  notAllowedAction: 'Your role does not allow this.',
  refused: 'That change was refused. A change takes effect from now or later, and once at each time for a table type.',
  inForce: 'That change is already in force, so it stays. Schedule another to replace it.',
  unavailable: 'That did not go through. Check the connection and try again.',
};

export const consoleRake = { rake };
