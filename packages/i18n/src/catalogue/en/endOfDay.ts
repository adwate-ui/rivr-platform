/**
 * The console's End of day (#45): closing the cage's shift against the ledger, and the review an
 * anomaly needs before the day closes.
 */
export const endOfDay = {
  title: 'End of day',
  notAllowed: 'Your role does not include End of day. Cashiers, managers and owners see it.',
  close: 'Close the shift',
  noShift: 'No shift open. A cashier opens one on Treasury with the float and the chips.',
  openNotYours: 'A shift is open. A cashier closes it here.',
  /** Above the form: what to count, before any expected figure is shown. */
  closeIntro: 'Count the drawer and the chips, with the drop boxes in the cage, and take the receipts from the bank statement. Each is set against the ledger when you close.',
  cash: 'Cash in the drawer',
  receipts: 'UPI and bank receipts',
  markers: 'Signed markers held',
  chips: 'Chips in the cage',
  amountInvalid: 'Enter whole rupees, 0 for none.',
  closeShift: 'Close shift',
  closed: 'Shift closed. Its figures are below.',
  closes: 'Closes',
  noCloses: 'No shift closed yet.',
  /** A close: `{opened}` and `{closed}` are when the shift opened and closed, `{name}` who closed it. */
  closeLine: '{opened} to {closed}, closed by {name}',
  /** One figure: `{counted}`, `{expected}` and `{variance}` are amounts, the variance below zero when short. */
  figure: 'Counted {counted} · expected {expected} · variance {variance}',
  clean: 'Closed to zero variance.',
  anomaly: 'Variance. The day closes once a manager gives the reason.',
  /** `{name}` reviewed it; `{reason}` is theirs. */
  reviewed: 'Reviewed by {name}: {reason}',
  waitingForManager: 'A manager who neither opened nor closed this shift gives the reason.',
  reasonFor: 'Reason for the variance',
  reasonInvalid: 'Give the reason in 3 to 500 characters.',
  recordReason: 'Record reason',
};

/** Why a close or a review did not go through. */
export const endOfDayFailures = {
  noShift: 'No shift is open. The screen now shows where it stands.',
  invalid: 'Count every chip and give each amount in whole rupees.',
  notAllowed: 'Only a cashier closes the shift, and only a manager who neither opened nor closed it gives the reason.',
  noReview: 'This close has no variance waiting. The list now shows where it stands.',
  unavailable: 'Could not save this. Check the connection and try again.',
};
