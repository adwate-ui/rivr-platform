/** The console's Academy copy: batches and bookings, payments the cage checks, and why a step failed. */
/** Academy batches and bookings, for Academy staff. `{taken}` and `{seats}` are counts. */
export const academy = {
  title: 'Academy',
  newBatch: 'New batch',
  batchName: 'Name',
  startsOn: 'First day',
  endsOn: 'Last day',
  seats: 'Seats',
  openBatch: 'Open batch',
  batchInvalid: 'Give the batch a name, a first and last day in order, and 1 to 500 seats.',
  noBatches: 'No batches yet.',
  dates: '{from} to {to}',
  booked: '{taken} of {seats} seats booked',
  closed: 'Closed for booking.',
  noBookings: 'No bookings yet.',
  /** A company's booking: the company, its heads and its contact. */
  company: '{company}, {seats} heads, contact {name}',
  companyOneHead: '{company}, 1 head, contact {name}',
  awaiting: 'Waiting for payment.',
  claimed: 'UTR {utr}, waiting for the cage.',
  paid: 'Paid.',
  /** The UTR field on one booking; `{name}` says whose. */
  utrFor: 'UTR for {name}',
  recordUtr: 'Record UTR',
  utrInvalid: 'Enter the 12-digit UTR from the payment.',
  cancel: 'Cancel booking',
  bookCompany: 'Book for a company',
  contactPhone: 'Contact mobile number',
  companyName: 'Company',
  companyGstin: 'Company GSTIN, if it has one',
  heads: 'Heads',
  book: 'Book',
  companyInvalid: 'Give the contact\'s 10-digit number, the company, 1 to 100 heads, and its GSTIN only if it has one.',
} as const;

/** Academy payments the cage checks against the bank. */
export const academyPayments = {
  title: 'Academy payments',
  empty: 'No payments to check.',
  payment: 'UTR {utr}',
  found: 'Found in the bank',
  notFound: 'Not in the bank',
  /** The UTR on the screen is not the one on the booking any more. */
  changed: 'The payer changed this UTR to {utr}. Look for the new one.',
  checkNew: 'Check the new UTR',
  /** The staff member who recorded a UTR never confirms it. */
  recordedByYou: 'You recorded this UTR, so another staff member confirms it.',
} as const;

/** Why an Academy step did not go through. */
export const academyFailures = {
  notAllowed: 'Your role does not allow this. Ask a manager, or another staff member who can.',
  noMember: 'No member has that number. Sign the contact up first.',
  invalid: 'Check the details and try again.',
  full: 'Not enough seats left in this batch. Choose another batch, or fewer heads.',
  closed: 'This batch is closed or has started. Choose another batch.',
  noFee: 'The Academy fees are not set. Set them before booking.',
  noPayment: 'This booking has no payment to act on. Check it again.',
  utrMismatch: 'The payer changed the UTR on this booking. Look for the new one.',
  utrUsed: 'This UTR is already on another booking. Check it with the payer.',
  stopped: 'The venue or this member is frozen. Try again once it is released.',
  unavailable: 'Could not save this. Check the connection and try again.',
} as const;
