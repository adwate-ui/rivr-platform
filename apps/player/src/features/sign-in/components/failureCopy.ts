import type { SignInFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** What the screen says for each way a sign-in step can fail. */
export const FAILURE_COPY: Readonly<Record<SignInFailure, MessageKey>> = {
  code_rejected: 'common.signIn.codeRejected',
  too_many_requests: 'common.signIn.tooManyRequests',
  unavailable: 'common.signIn.unavailable',
};
