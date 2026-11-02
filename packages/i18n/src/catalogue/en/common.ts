/** Copy shared by every surface: states every screen has. */
export const common = {
  loading: 'Loading',
  retry: 'Try again',
  loadFailed: 'Not loaded. Try again.',
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
    /** A second code goes by SMS: the first may not have reached WhatsApp (#181). */
    resend: 'Send by SMS',
    resendIn: 'Send by SMS in {seconds} s',
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
