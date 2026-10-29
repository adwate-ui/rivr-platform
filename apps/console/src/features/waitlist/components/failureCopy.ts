import type { WaitlistFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** What the console's Waitlist says when adding or removing did not go through. */
export const FAILURE_COPY: Readonly<Record<WaitlistFailure, MessageKey>> = {
  not_open: 'console.waitlist.notOpen',
  kyc_needed: 'console.waitlist.kycNeeded',
  on_break: 'console.waitlist.onBreak',
  stopped: 'console.waitlist.stopped',
  paused: 'console.waitlist.paused',
  no_member: 'console.waitlist.noMember',
  invalid: 'console.waitlist.invalid',
  unavailable: 'console.waitlist.unavailable',
  seat_held: 'console.waitlist.seatHeld',
  seat_taken: 'console.waitlist.seatTaken',
  too_late: 'console.waitlist.tooLate',
  no_time_away: 'console.waitlist.noTimeAway',
  one_at_a_time: 'console.waitlist.oneAtATime',
};

/** The same for Call, Seat, Skip and Back, where a refused request means the place or table changed. */
export const ENTRY_FAILURE_COPY: Readonly<Record<WaitlistFailure, MessageKey>> = { ...FAILURE_COPY, invalid: 'console.waitlist.changed' };

/** Back: refused as too late means the member was away too long, not that a hold ran out (#287). */
export const BACK_FAILURE_COPY: Readonly<Record<WaitlistFailure, MessageKey>> = { ...ENTRY_FAILURE_COPY, too_late: 'console.waitlist.awayTooLong' };
