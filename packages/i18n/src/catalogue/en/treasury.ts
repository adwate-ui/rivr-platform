/**
 * The console's Treasury (#24), as in the prototype: what the venue holds for players, the chips in play,
 * and the cage's shift with its float and its count of chips by denomination.
 */
export const treasury = {
  /** One screen for the cage's shift (#606): its opening and counts, then its closing and history. */
  shiftScreen: 'Shift',
  tabs: { now: 'Opening and counts', close: 'Closing and history' },
  notAllowed: 'Your role does not include the cage\'s shift. Cashiers, managers and owners see it.',
  /** What the venue holds, from the ledger. */
  wallets: 'Member wallets',
  withdrawalsPending: 'Withdrawals pending',
  bonus: 'Bonus liability',
  markers: 'Markers outstanding',
  jackpots: 'Jackpots held',
  chipsInPlay: 'Chips in play',
  float: 'Cage float',
  /** The cage float's row while no shift is open. */
  noFloat: 'No shift open',
  shift: 'Cage shift',
  /** `{time}` is when the shift opened, `{name}` who opened it. */
  shiftOpen: 'Opened {time} by {name}',
  noShift: 'No shift open. A cashier opens one with the float and a count of the chips.',
  openShift: 'Open shift',
  floatToOpen: 'Float in the drawer',
  floatInvalid: 'Enter the float in whole rupees.',
  rupee: '₹',
  chips: 'Chips in the cage',
  chip: 'Chip',
  quantity: 'Count',
  value: 'Value',
  inCage: 'In the cage',
  notCounted: 'Not counted',
  /** `{time}` and `{name}`: when the chips were last counted, and by whom. */
  counted: 'Counted {time} by {name}',
  /** The field for one chip: `{chip}` is its name, such as ₹500. */
  countOf: '{chip} chips',
  countInvalid: 'Count each chip as a whole number, 0 for none.',
  countChips: 'Count chips',
  saveCount: 'Save count',
  cancel: 'Cancel',
  opened: 'Shift opened.',
  saved: 'Count saved.',
};

/** Why a shift or a count did not go through. */
export const treasuryFailures = {
  shiftOpen: 'A shift is open already. The screen now shows it.',
  noShift: 'No shift is open. Open one with the float first.',
  invalid: 'Count every chip, 0 for none, and give the float in whole rupees.',
  notAllowed: 'Only a cashier opens the cage and counts its chips.',
  unavailable: 'Could not save this. Check the connection and try again.',
};
