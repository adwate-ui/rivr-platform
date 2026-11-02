/** The player app's sign-in, as the redesign has it (decision 0320). Staff sign in with `common.signIn`. */
export const playerSignIn = {
  title: 'Sign in or join',
  phoneLabel: 'Mobile number',
  phonePlaceholder: '98765 43210',
  phoneInvalid: 'Enter a 10-digit mobile number.',
  sendCode: 'Send code',
  legal: 'Members only, 18+. By continuing you accept the terms and privacy notice.',
  back: 'Back',
  codeTitle: 'Enter the code',
  /** Codes go by WhatsApp through the Evolution bridge (decision 0297), so the line says so, not SMS. */
  codeSent: 'Sent on WhatsApp to {phone}',
  codeLabel: '6-digit code',
  /** Auth gives no count of tries left, so the prototype's "2 tries left." is not said. */
  codeRejected: "That code didn't match.",
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
