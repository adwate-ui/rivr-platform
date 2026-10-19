import type { WaitlistFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** What the console's Waitlist says when adding or removing did not go through. */
export const FAILURE_COPY: Readonly<Record<WaitlistFailure, MessageKey>> = {
  not_open: 'console.waitlist.notOpen',
  kyc_needed: 'console.waitlist.kycNeeded',
  stopped: 'console.waitlist.stopped',
  paused: 'console.waitlist.paused',
  no_member: 'console.waitlist.noMember',
  invalid: 'console.waitlist.invalid',
  unavailable: 'console.waitlist.unavailable',
};
