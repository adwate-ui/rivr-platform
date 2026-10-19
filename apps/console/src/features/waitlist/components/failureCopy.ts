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
  seat_held: 'console.waitlist.seatHeld',
  too_late: 'console.waitlist.tooLate',
  no_time_away: 'console.waitlist.noTimeAway',
};

/** The same for Call, Seat, Skip and Back, where a refused request means the place or table changed. */
export const ENTRY_FAILURE_COPY: Readonly<Record<WaitlistFailure, MessageKey>> = { ...FAILURE_COPY, invalid: 'console.waitlist.changed' };
