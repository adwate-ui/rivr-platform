import type { DealerSignInFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';

const REFUSAL_COPY: Readonly<Record<Exclude<DealerSignInFailure['reason'], 'wrong_pin'>, MessageKey>> = {
  locked: 'tablet.dealerSignIn.locked',
  paused: 'tablet.dealerSignIn.paused',
  unavailable: 'tablet.dealerSignIn.unavailable',
};

/** What the tablet says when a dealer's sign-in did not go through: a wrong PIN says how many tries are left. */
export function signInFailureText(failure: DealerSignInFailure): string {
  if (failure.reason !== 'wrong_pin') return t(REFUSAL_COPY[failure.reason]);
  return failure.triesLeft === 1 ? t('tablet.dealerSignIn.wrongPinLast') : t('tablet.dealerSignIn.wrongPin', { count: failure.triesLeft });
}
