/**
 * Copy for each app's own screens, one area per app. Lanes add to their app's area as they
 * build screens; a large area moves into its own namespace file.
 */
export const playerApp = {
  tonight: { title: 'Tonight', empty: 'No tables are running.' },
  sessions: { title: 'Sessions', empty: 'No sessions yet.' },
  balance: { title: 'Balance', empty: 'No movements yet.' },
  rewards: { title: 'Rewards', empty: 'No rewards yet.' },
  learn: { title: 'Learn', empty: 'No sources yet.' },
  /** Profile, behind the member's initial. */
  profile: {
    title: 'Profile',
    identity: 'Identity',
    kycIncomplete: 'KYC incomplete. Finish it to join a table.',
    kycReview: 'With staff. They finish your check at the club.',
    kycVerified: 'Verified · DigiLocker and selfie',
    kycRefused: 'Not verified. Speak to the front desk.',
    finishKyc: 'Finish identity check',
    alerts: 'Waitlist alerts',
    alertsHint: 'We tell you when a seat opens in these games.',
    games: 'Games',
    nlh: 'NLH',
    plo: 'PLO',
    tournaments: 'Tournaments',
    notifications: 'Notifications',
    seatCalls: 'Seat calls',
    seatCallsHint: 'When your seat is ready.',
    callTime: 'Call time',
    callTimeHint: 'When your call time is complete.',
    withdrawals: 'Withdrawals',
    withdrawalsHint: 'When a withdrawal is sent.',
    tournamentStarts: 'Tournaments',
    tournamentStartsHint: 'When a tournament you entered is starting.',
    marketing: 'Promotions and offers',
    marketingHint: 'By WhatsApp and app notification. Stop any time.',
    saveFailed: 'Not saved. Try again.',
    responsiblePlay: 'Responsible play',
    responsiblePlayHint: 'Set limits or take a break.',
    limits: 'Limits and self-exclusion',
  },
  limits: { title: 'Limits and self-exclusion', empty: 'Ask at the front desk to set limits or take a break.' },
  /** Joining the club after the first code: the name on the player's Aadhaar. */
  signUp: {
    title: 'Your name',
    intro: 'Your full name as on your Aadhaar. We check it when you verify your identity.',
    nameLabel: 'Full name as on your Aadhaar',
    submit: 'Continue',
    nameInvalid: 'Enter your full name in English letters, as on your Aadhaar.',
    staff: 'Staff join as members at the front desk.',
    stopped: 'New sign-ups are paused for now. Try again later.',
    unavailable: 'Sign-up is not available right now. Try again in a few minutes.',
  },
  /** KYC: DigiLocker, or a PAN when DigiLocker fails. Only the masked Aadhaar is ever shown. */
  kyc: {
    title: 'Identity',
    intro: 'We check your identity with a selfie and DigiLocker. We keep your photo, masked Aadhaar, PAN, date of birth and address, and nothing else.',
    selfieIntro: 'First, a selfie. Hold the phone at eye level, face inside the frame.',
    takeSelfie: 'Take a selfie',
    notLive: 'We could not use that photo. Face the camera in good light and try again.',
    digilockerIntro: 'Your selfie is in. Next, DigiLocker shares your Aadhaar and PAN with us. We keep the masked Aadhaar only.',
    start: 'Continue with DigiLocker',
    checking: 'Checking your identity',
    verifiedTitle: 'Identity verified',
    dateOfBirthLabel: 'Date of birth',
    aadhaarLabel: 'Aadhaar',
    panLabel: 'PAN',
    continue: 'Continue',
    panTitle: 'PAN',
    panIntro: 'Enter your PAN to finish.',
    panPlaceholder: 'ABCDE1234F',
    verify: 'Verify',
    panInvalid: 'Enter a PAN like ABCDE1234F.',
    dateOfBirthInvalid: 'Enter your date of birth.',
    panRejected: 'This PAN did not match. Check it and the name, then try again.',
    reviewTitle: 'With staff',
    refusedTitle: 'Not verified',
    refused: 'We could not complete your identity check. Speak to the front desk at the club.',
    review: 'Staff will check your documents at the club to finish.',
    stopped: 'Identity checks are paused for now. Try again later.',
    tooManyAttempts: 'Too many tries today. Try again tomorrow, or ask at the club.',
    notConfigured: 'Identity checks are not open yet. Staff will check your documents at the club.',
    unavailable: 'Identity checks are not available right now. Try again in a few minutes.',
  },
} as const;

export const consoleApp = {
  /** The heading while the console finds the staff member's venue, or fails to. */
  title: 'Console',
  liveFloor: { title: 'Live floor', empty: 'No tables are running.' },
  /** Someone signed in who is not active staff at any venue. */
  notStaff: {
    title: 'Staff only',
    body: 'This console is for RIVR staff. A manager can add your number to the staff list.',
  },
  /** At the foot of the rail: switches the console to the practice venue, where staff train. */
  practice: 'Practice venue',
} as const;

export const tabletApp = {
  /** The table name in the header before the tablet is assigned to a table. */
  unassignedTable: 'Not assigned',
  handEntry: { title: 'Hand entry', empty: 'This tablet is not assigned to a table.' },
} as const;

export const displayApp = {
  unpaired: 'This screen is not paired.',
} as const;

export const driverApp = {
  pickups: { title: 'Pickups', empty: 'No pickups.' },
} as const;

export const webApp = {
  opening: 'Opens Sunday 15 November.',
} as const;
