import type { WaitlistFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** What Home says when joining or leaving a waitlist did not go through. */
export const WAITLIST_FAILURE_COPY: Readonly<Record<WaitlistFailure, MessageKey>> = {
  not_open: 'player.tonight.notOpen',
  kyc_needed: 'player.tonight.kycNeeded',
  stopped: 'player.tonight.stopped',
  no_member: 'player.tonight.unavailable',
  invalid: 'player.tonight.unavailable',
  unavailable: 'player.tonight.unavailable',
};
