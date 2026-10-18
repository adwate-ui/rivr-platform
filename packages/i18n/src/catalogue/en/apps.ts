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
  profile: { title: 'Profile', empty: 'Sign in to see your profile.' },
  /** Sign-in: a mobile number, then the six-digit code sent to it. `{phone}` is `+91 98765 43210`. */
  signIn: {
    phoneLabel: 'Mobile number',
    countryCode: '+91',
    sendCode: 'Send code',
    codeTitle: 'Code',
    codeLabel: 'Code sent to {phone}',
    codePlaceholder: '6 digits',
    submit: 'Verify',
    changeNumber: 'Change number',
    resend: 'Send again',
    resendIn: 'Send again in {seconds} s',
    phoneInvalid: 'Enter a 10-digit mobile number.',
    codeInvalid: 'Enter the 6-digit code.',
    codeRejected: 'Code wrong or expired. Check it, or request a new one.',
    tooManyRequests: 'Too many attempts. Wait a minute, then try again.',
    unavailable: 'Sign-in is not available right now. Try again in a few minutes.',
  },
} as const;

export const consoleApp = {
  liveFloor: { title: 'Live floor', empty: 'No tables are running.' },
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
