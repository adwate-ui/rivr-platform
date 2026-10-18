/** A check in person at the club (#246), on the console's KYC review screen. `{name}` is the member's. */
export const kycInPerson = {
  /** How the check was done, in the queue, where a vendor's check says DigiLocker. */
  method: 'In person',
  title: 'Check in person',
  hint: 'For a member at the club with their original Aadhaar and PAN card.',
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
  consentHint: 'Ask them first. Their answer is recorded with your name.',
  verifyName: 'Verify {name}',
  invalid: 'Take their photo, enter the date of birth, the last four Aadhaar digits and the PAN from the originals, and record their consent.',
  verified: '{name} is verified and can take a seat.',
  refused: '{name} was refused. The refused checks below say why.',
} as const;

/** Why a check in person did not go through. */
export const kycInPersonFailures = {
  notAllowed: 'Your role does not allow this, and nobody checks themselves. Ask another reviewer.',
  decided: 'This member\'s check is already decided or waiting for review. The list below shows it.',
  noPhoto: 'The photo did not arrive. Take it again.',
  invalid: 'Check the photo, the date of birth, the last four Aadhaar digits and the PAN.',
  stopped: 'KYC sign-up is switched off, or the venue or this member is frozen. Try again once it is released.',
  unavailable: 'Could not save this. Check the connection and try again.',
} as const;
