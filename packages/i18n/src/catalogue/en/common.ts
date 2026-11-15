/** Copy shared by every surface: states every screen has. */
export const common = {
  loading: 'Loading',
  retry: 'Try again',
  loadFailed: 'Not loaded. Try again.',
  /** A whole player screen that failed (F-176): the serif line, and what to do under it. */
  loadFailedTitle: 'Could not load',
  checkConnection: 'Check your connection and try again.',
  /** A screen that failed to draw: its title on the router's error screen. */
  screenFailed: 'Screen unavailable',
  offline: 'Offline.',
  close: 'Close',
  cancel: 'Cancel',
  confirm: 'Confirm',
  back: 'Back',
  /** The heading over notFound. */
  notFoundTitle: 'Page not found',
  notFound: 'This page is not here. Check the address, or go back.',
  /**
   * The high hand bonus (redesign RD-22), wherever it is named: the hands a promotion lists, a rank as "Four Jacks" and
   * "Kings full" say it, a straight flush's high card, a hit named exactly, and the rules. Read through formatHighHand.
   */
  highHand: {
    hands: { royal_flush: 'Royal flush', straight_flush: 'Straight flush', four_of_a_kind: 'Four of a kind', aces_full: 'Aces full', full_house: 'Any full house' },
    ranks: {
      ace: 'Aces', king: 'Kings', queen: 'Queens', jack: 'Jacks', ten: 'Tens', nine: 'Nines', eight: 'Eights', seven: 'Sevens', six: 'Sixes', five: 'Fives',
      four: 'Fours', three: 'Threes', two: 'Twos',
    },
    highCards: { king: 'King', queen: 'Queen', jack: 'Jack', ten: 'Ten', nine: 'Nine', eight: 'Eight', seven: 'Seven', six: 'Six', five: 'Five' },
    hit: { straightFlush: 'Straight flush, {rank} high', fourOfAKind: 'Four {rank}', fullHouse: '{rank} full' },
    rules: { bothHoleCards: 'Both hole cards must play', shownAtShowdown: 'Shown at showdown', playersDealt: '{count} or more players dealt in' },
  },
  /** LockedNotice: a feature this member's tier does not have. `{tiers}` is a formatted list. */
  featureLocked: '{tiers} only.',
  /** LockedNotice: a feature taken from this member alone by the club (#353), so no tier is the way in. */
  featureUnavailable: 'Not on your membership.',
  /**
   * Sign-in by mobile number, then the six-digit code sent to it: members in the player app, staff
   * in the console. `{phone}` is `+91 98765 43210`.
   */
  signIn: {
    /** The console's number step: staff only sign in. */
    title: 'Sign in',
    /** The player app's number step: a number the club does not know goes on to join (S-01). */
    joinTitle: 'Sign in or join',
    phoneLabel: 'Mobile number',
    countryCode: '+91',
    sendCode: 'Send code',
    /** Under Send code: where to look (decision 0025, WhatsApp first). */
    channels: 'Code by WhatsApp or SMS.',
    codeTitle: 'Sign-in code',
    codeLabel: 'Code sent to {phone}',
    /** After Send by SMS (#181). */
    codeLabelBySms: 'Code sent by SMS to {phone}',
    submit: 'Verify',
    changeNumber: 'Change number',
    /** A second code goes by SMS: the first may not have reached WhatsApp (#181). `{time}` counts down, 0:24. */
    resend: 'Send by SMS',
    resendIn: 'Send by SMS in {time}',
    phoneInvalid: 'Enter a 10-digit mobile number.',
    codeInvalid: 'Enter the 6-digit code.',
    codeRejected: 'Wrong or expired code. Check it or send a new one.',
    tooManyRequests: 'Too many tries. Wait a minute.',
    /** The security check (Cloudflare Turnstile) did not finish or failed (#182). */
    notChecked: 'Security check incomplete. Send again.',
    unavailable: 'Sign-in is down. Try again shortly.',
    signOut: 'Sign out',
    /** Sign-in opened while someone is still signed in on this device, such as a bookmark on a shared computer. */
    signedInTitle: 'This device',
    signedInAs: '{name} is signed in on this device.',
    signedInSomeone: 'Someone is signed in on this device.',
    signedInChecking: 'Checking who is signed in on this device.',
    continueAs: 'Continue as {name}',
    continue: 'Continue',
  },
} as const;
