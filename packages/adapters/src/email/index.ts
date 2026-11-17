export type { EmailAdapter, EmailMessage } from './types.ts';
export { createFakeEmail, type FakeEmail } from './fake.ts';
export { fencedEmail } from './fenced.ts';
export { createResendEmail, RESEND_EMAILS_URL, type ResendOptions } from './live.ts';
