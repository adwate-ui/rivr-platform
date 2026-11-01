/** A check in person at the club (#246), on the console's KYC review screen. `{name}` is the member's. */
export const kycInPerson = {
  /** How the check was done, in the queue, where a vendor's check says DigiLocker. */
  method: 'In person',
  title: 'Check in person',
  hint: 'Originals in hand. Photograph the face, never a document.',
  search: 'Member\'s name or the last digits of their number',
  noMatch: 'No member with an unfinished check matches.',
  /** `{digits}` is the last four digits of the member's mobile number. */
  phoneEnding: 'Mobile ending {digits}',
  startedOnApp: 'Started on the app, not finished.',
  checkName: 'Check {name}',
  takePhoto: 'Take their photo',
  retakePhoto: 'Take the photo again',
  aadhaarLast4For: 'Last four digits of {name}\'s Aadhaar',
  consentFor: '{name} agrees to this identity check',
  consentHint: 'Ask first. Recorded with your name.',
  verifyName: 'Verify {name}',
  invalid: 'Photo, date of birth, last four Aadhaar digits, PAN and consent are needed.',
  verified: '{name} is verified and can take a seat.',
  refused: '{name} refused. See the checks below.',
  needsReview: '{name} goes to review: it matches another check. See the list below.',
  /** A super admin reopens a refused check done in person (#267). */
  reopenFor: 'Reason for reopening {name}\'s check',
  reopenHint: 'In words only: no numbers or dates.',
  reopen: 'Reopen the check',
} as const;

/** Why a check in person did not go through. */
export const kycInPersonFailures = {
  notAllowed: 'Not allowed: reviewers only, never for themselves or a member they added or changed.',
  decided: 'Already decided, in review, or waiting for their PAN.',
  noPhoto: 'Photo not received. Take it again.',
  invalid: 'Check the photo, date of birth, Aadhaar digits and PAN.',
  stopped: 'KYC is paused, or the member is frozen.',
  unavailable: 'Not saved. Try again.',
} as const;
