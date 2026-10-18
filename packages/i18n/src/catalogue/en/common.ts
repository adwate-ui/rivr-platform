/** Copy shared by every surface: states every screen has. */
export const common = {
  loading: 'Loading',
  retry: 'Try again',
  loadFailed: 'Could not load this. Check the connection and try again.',
  offline: 'Offline.',
  close: 'Close',
  cancel: 'Cancel',
  confirm: 'Confirm',
  back: 'Back',
  /** The heading over notFound. */
  notFoundTitle: 'Page not found',
  notFound: 'This page does not exist.',
  /** LockedNotice: a feature this member's tier does not have. `{tiers}` is a formatted list. */
  featureLocked: '{tiers} only.',
  /**
   * Sign-in by mobile number, then the six-digit code sent to it: members in the player app, staff
   * in the console. `{phone}` is `+91 98765 43210`.
   */
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
