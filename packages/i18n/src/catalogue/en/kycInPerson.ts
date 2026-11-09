/** A check in person at the club (#246), on the console's KYC review screen. `{name}` is the member's. */
export const kycInPerson = {
  /** How the check was done, in the queue, where a vendor's check says DigiLocker. */
  method: 'In person',
  title: 'ID check in person',
  hint: 'Originals in hand. Photograph the face, the PAN card and the Aadhaar front.',
  search: 'Member\'s name or the last digits of their number',
  noMatch: 'No member with an unfinished check matches.',
  /** `{digits}` is the last four digits of the member's mobile number. */
  phoneEnding: 'Mobile ending {digits}',
  startedOnApp: 'Started on the app, not finished.',
  /** A member let in by their selfie, to be checked at the club (decision 0502). */
  atTheClub: 'Selfie taken in the app. Check their originals.',
  /** A check that waited for a PAN check Cashfree no longer runs: the desk completes it (audit F-010). */
  heldForPan: 'Waiting for a PAN. Check their originals.',
  /** A verified member, due at the desk only for a photo a super admin sent back (decision 0573). */
  sentBack: 'A photo was sent back. Take it again.',
  /** Under the card being asked for again: a super admin's own words. */
  sentBackReason: 'Sent back: {reason}.',
  /** Under the search before anything is typed: members in the room or on a list whose check is not done (F-091). */
  dueTonight: 'Due tonight',
  noneDue: 'No checks due tonight.',
  /** Their app selfie beside the camera, to compare with the face at the desk. */
  appSelfieOf: 'The selfie {name} took in the app',
  /** A found member's button, and its full name for a screen reader. */
  check: 'Check',
  checkName: 'Check {name}',
  takePhoto: 'Take their photo',
  retakePhoto: 'Take the photo again',
  /** The two cards photographed at the desk (decision 0573). */
  document: { pan: 'PAN card', aadhaar_front: 'Aadhaar front' },
  /** Above the camera. */
  photoStep: 'Photo {place} of {total}',
  documentOf: '{document} of {name}',
  /** A card's row: one short word on its button, its full name read out. */
  takeDocument: 'Take',
  takeDocumentName: 'Photograph the {document}',
  retakeDocument: 'Retake',
  retakeDocumentName: 'Take the {document} again',
  /** The switch that unlocks an Aadhaar photo: the server records who said so. */
  coverConfirm: 'The bars hide the first 8 digits and the QR code. The last 4 digits can still be read.',
  retakeHint: 'Take the photo again. The rest of {name}\'s check stands.',
  retaken: 'New photo kept for {name}.',
  aadhaarLast4For: 'Last four digits of {name}\'s Aadhaar',
  consentFor: '{name} agrees to this ID check',
  consentHint: 'Ask first: their PAN and Aadhaar photos are kept. Recorded with your name.',
  verifyName: 'Verify {name}',
  invalid: 'All three photos, date of birth, last four Aadhaar digits, PAN and consent are needed.',
  verified: '{name} is verified and can take a seat.',
  refused: '{name} refused. See the checks below.',
  needsReview: '{name} goes to review: it matches another check. See the list below.',
  /** A super admin reopens a refused check done in person (#267). */
  reopenFor: 'Reason for reopening {name}\'s check',
  reopenHint: 'In words only: no numbers or dates.',
  reopen: 'Reopen the check',
  /** A member's record, for super admins (decision 0573). */
  documentsTitle: 'ID documents',
  documentsHint: 'Each opening is recorded.',
  documentsNone: 'No ID photos on file.',
  documentTaken: 'Taken {date} by {name}',
  documentBars: 'Bars confirmed by {name}',
  openDocument: 'Open',
  openDocumentName: 'Open the {document}',
  hideDocument: 'Hide',
  hideDocumentName: 'Hide the {document}',
  documentSentBack: 'Sent back: {reason}. Waiting for the desk.',
  sendBackFor: 'Why the {document} needs taking again',
  sendBack: 'Send back',
  sendBackFailures: {
    not_allowed: 'Super admins only.',
    invalid: 'Say why in words: three letters at least, no numbers.',
    unavailable: 'Not sent. Try again.',
  },
} as const;

/** Why a check in person did not go through. */
export const kycInPersonFailures = {
  notAllowed: 'Not allowed: reviewers only, never for themselves, a member they added or changed, or a photo they sent back.',
  decided: 'Already decided, in review, or waiting for their PAN.',
  noPhoto: 'Photo not received. Take it again.',
  invalid: 'Check the photos, date of birth, Aadhaar digits and PAN.',
  stopped: 'ID checks are paused, or the member is frozen.',
  unavailable: 'Not saved. Try again.',
} as const;
