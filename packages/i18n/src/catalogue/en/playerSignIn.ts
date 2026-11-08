/** The player app's sign-in, as the redesign has it (decision 0320). Staff sign in with `common.signIn`. */
export const playerSignIn = {
  title: 'Sign in or join',
  phoneLabel: 'Mobile number',
  phonePlaceholder: '98765 43210',
  phoneInvalid: 'Enter a 10-digit mobile number.',
  /** Under the number, before Send code: where the code goes (decision 0297). */
  phoneHint: 'Code comes on WhatsApp.',
  sendCode: 'Send code',
  /** Opened with no connection (F-175): over the step, with Send code held back. */
  offline: 'No connection. Send the code once you are back online.',
  legal: 'Members only, 18+. By continuing you accept the terms and privacy notice.',
  /** The links under the legal line, to the website's pages (#775). */
  terms: 'Terms',
  privacy: 'Privacy notice',
  back: 'Back',
  codeTitle: 'Enter the code',
  /** Codes go by WhatsApp through the Evolution bridge (decision 0297), so the line says so, not SMS. */
  codeSent: 'Sent on WhatsApp to {phone}',
  codeLabel: '6-digit code',
  /** Auth gives no count of tries left, so the prototype's "2 tries left." is not said. */
  codeRejected: 'Wrong or expired code. Check it, or resend.',
  verify: 'Verify',
  /** `{time}` counts down, 0:24. */
  resendIn: 'Resend code in {time}',
  resend: 'Resend code',
  /** The cookie choice, a sheet on first launch (decision 0298). */
  cookies: {
    title: 'Cookies',
    text: 'Essential storage only, unless you allow analytics.',
    essential: 'Essential only',
    allow: 'Allow analytics',
  },
} as const;
