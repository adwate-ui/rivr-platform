/** The console's KYC review queue (#31). `{name}` is the member's; scores are 0 to 100. */
export const kycReview = {
  title: 'KYC review',
  notAllowed: 'Not in your role. Ask an admin.',
  empty: 'No checks waiting for review.',
  /** The queue down the left (console v3), read as its name; then its groups, each with its count. */
  queue: 'Checks',
  waiting: 'To review',
  /** Checks that wait for the member, for a PAN: nothing for a reviewer to decide yet (C-06). */
  onMember: 'Waiting on the member',
  /** The last 90 days of them (F1-31). */
  refused: 'Refused, last 90 days',
  /** A check's line in the queue: how it was made, and the time it began to wait. */
  queueLine: '{method} · {since}',
  needsPanLine: 'Needs a PAN · since {since}',
  /** How long a check has waited, from the second day: `15 Nov · 47 days`. */
  sinceDays: '{date} · {days} days',
  sinceOneDay: '{date} · 1 day',
  /** On a phone, from the check open back to the queue. */
  back: 'Back to KYC review',
  photoOf: 'KYC photo of {name}',
  /** Why a check waits for a reviewer. */
  waitPanAlone: 'PAN only, no DigiLocker. Check the card and the person.',
  waitNothingKept: 'DigiLocker gave another name or face. Check the originals.',
  waitNoDateOfBirth: 'No date of birth from DigiLocker. Check the original.',
  waitClash: 'Matches another check: PAN, Aadhaar, face, or name, birth date and last four digits.',
  /** A check made in person, re-checked with the vendor once one was live (#259). */
  waitRecheckPanInvalid: 'The vendor does not know this PAN. Check the card again.',
  waitRecheckNameDiffers: 'The vendor has this PAN in another name. Check the card again.',
  waitRecheckDateOfBirthDiffers: 'The vendor has another date of birth for this PAN. Check the originals.',
  /** `{date}` and `{time}` are when the check began to wait. */
  since: 'In the queue since {date}, {time}',
  vendorReference: 'Vendor reference',
  panFor: '{name}\'s PAN from the original card',
  digilocker: 'DigiLocker',
  panAlone: 'PAN alone',
  needsPan: 'Waiting for the member to give a PAN.',
  dateOfBirth: 'Date of birth',
  notKept: 'Not kept. Check the original document.',
  aadhaar: 'Aadhaar',
  pan: 'PAN',
  address: 'Address',
  none: 'None',
  scores: 'Liveness {liveness}, face match {match}',
  /** How a check with no scores was made: DigiLocker, PAN alone or in person. */
  method: 'Method',
  clashes: 'Matches: {names}',
  underEighteen: 'Refused: under the minimum age.',
  duplicateFace: 'Refused: the face of a verified member.',
  duplicatePan: 'Refused: the PAN of a verified member.',
  duplicateAadhaar: 'Refused: the Aadhaar of a verified member.',
  staffRejected: 'Rejected by a reviewer.',
  onBreak: 'Refused: an erased member whose break has not ended.',
  reasonFor: 'Reason for {name}',
  reasonHint: 'In words. Never document numbers.',
  dateOfBirthFor: 'Date of birth on {name}\'s original document',
  approve: 'Approve',
  reject: 'Reject',
  reasonInvalid: 'Check the reason (3 to 500 characters, no document numbers), the date of birth and the PAN.',
};

/** Why a KYC decision did not go through. */
export const kycReviewFailures = {
  notAllowed: 'Not allowed: nobody decides their own check. Ask another reviewer.',
  decided: 'Already decided.',
  needsDateOfBirth: 'Enter the date of birth from the original.',
  needsPan: 'Enter the PAN from the original PAN card to approve.',
  invalid: 'Check the reason, the date of birth and the PAN.',
  paused: 'KYC is paused: approvals wait. Rejecting still works.',
  stopped: 'Venue or member frozen. Try again once released.',
  unavailable: 'Not saved. Try again.',
};
