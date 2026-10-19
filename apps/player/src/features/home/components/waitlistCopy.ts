import type { WaitlistFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** What Home says when joining or leaving a waitlist did not go through. */
export const WAITLIST_FAILURE_COPY: Readonly<Record<WaitlistFailure, MessageKey>> = {
  not_open: 'player.tonight.notOpen',
  kyc_needed: 'player.tonight.kycNeeded',
  stopped: 'player.tonight.stopped',
  paused: 'ui.killSwitch.member',
  no_member: 'player.tonight.unavailable',
  invalid: 'player.tonight.unavailable',
  unavailable: 'player.tonight.unavailable',
  // The floor's refusal; a member never calls anyone.
  seat_held: 'player.tonight.unavailable',
  too_late: 'player.tonight.tooLate',
  no_time_away: 'player.tonight.noTimeAway',
};
