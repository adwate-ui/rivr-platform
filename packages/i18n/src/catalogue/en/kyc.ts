/** The player app's identity check copy. */

/**
 * KYC, as the redesign has it (decision 0320): the selfie, DigiLocker, or a PAN when DigiLocker fails, from where the
 * member can try DigiLocker again. The front desk is named only once the check was refused. Only the masked Aadhaar is
 * ever shown.
 */
export const playerKyc = {
  title: 'Identity',
  /** Above the title: sign-up is step 1. */
  eyebrow: 'Step 2 of 2',
  startTitle: 'Verify your identity',
  /** A member back with the check partly done, at their step. */
  resumeTitle: 'Pick up where you left off',
  startSubtitle: 'Required before you play.',
  /** The three steps (K-09), read out as a list named this. */
  stepsLabel: 'Identity check',
  selfieStep: 'Selfie',
  selfieStepDetail: 'A photo of your face',
  digilockerStep: 'DigiLocker',
  digilockerStepDetail: 'Aadhaar and OTP',
  verifiedStep: 'Verified',
  kept: 'We store your photo, date of birth, address, PAN and the last 4 digits of your Aadhaar.',
  /** Identity checked at the club (decision 0502): the selfie in the app, the documents at the desk. */
  clubStep: 'At the club',
  clubStepDetail: 'Aadhaar and PAN at the desk, on your first visit',
  clubKept: 'We store your selfie now. At the desk we record your date of birth, PAN and the last 4 digits of your Aadhaar.',
  registeredTitle: "You're registered.",
  /** On the registered screen, and on Tonight's card until the desk has checked them. */
  atTheDesk: 'Bring your Aadhaar and PAN on your first visit. The desk checks them before you play.',
  /** The eyebrow of Tonight's card. */
  deskCheck: 'Identity check',
  takeSelfie: 'Take a selfie',
  notLive: 'Photo unclear. Retake it in good light.',
  start: 'Continue to DigiLocker',
  checking: 'Checking your documents',
  verifiedTitle: "You're verified.",
  /** `{name}` is the member's first name. */
  welcome: 'Welcome to RIVR, {name}.',
  toTonight: "See tonight's tables",
  panTitle: 'Verify with PAN',
  panIntro: 'Enter your PAN to finish.',
  panAfterDigilocker: "DigiLocker didn't finish. Use your PAN instead.",
  panLabel: 'PAN',
  panPlaceholder: 'ABCDE1234F',
  dateOfBirthLabel: 'Date of birth',
  dateOfBirthPlaceholder: 'DD / MM / YYYY',
  verify: 'Verify',
  panInvalid: 'Enter a PAN like ABCDE1234F.',
  dateOfBirthInvalid: 'Enter your date of birth.',
  panRejected: 'This PAN did not verify. Check it and try again.',
  tryDigilockerAgain: 'Try DigiLocker again',
  reviewTitle: "We're checking your details",
  review: "We'll notify you when it's done.",
  refusedTitle: "We couldn't verify you",
  refused: 'Bring your Aadhaar and PAN to the front desk.',
  stopped: 'Identity checks are paused. Try again later.',
  tooManyAttempts: 'Too many tries today. Try again tomorrow.',
  notConfigured: 'Identity checks are not open yet.',
  unavailable: 'Identity checks are down. Try again shortly.',
} as const;
