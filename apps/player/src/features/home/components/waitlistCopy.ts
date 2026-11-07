import type { WaitlistFailure, WaitlistPlace } from '@rivr/db';
import { formatOrdinal, t, type MessageKey } from '@rivr/i18n';

/** "Next in line", "2nd in line", a join the floor has not approved yet, or a seat held for the member now they are called. */
export function lineOf(place: WaitlistPlace): string {
  if (place.holdUntil !== null) return t('player.live.ready.eyebrow');
  if (place.place === null) return t('player.live.list.requested');
  return place.place === 1 ? t('player.live.list.next') : t('player.live.list.place', { ordinal: formatOrdinal(place.place) });
}

/** What Tonight says when joining, answering a call or leaving a waitlist did not go through. */
export const WAITLIST_FAILURE_COPY: Readonly<Record<WaitlistFailure, MessageKey>> = {
  not_open: 'player.tonight.notOpen',
  kyc_needed: 'player.tonight.kycNeeded',
  on_break: 'player.tonight.onBreak',
  stopped: 'player.tonight.stopped',
  paused: 'ui.killSwitch.member',
  no_member: 'player.tonight.unavailable',
  invalid: 'player.tonight.unavailable',
  unavailable: 'player.tonight.unavailable',
  // The floor's refusal; a member never calls anyone.
  seat_held: 'player.tonight.unavailable',
  seat_taken: 'player.tonight.unavailable',
  too_late: 'player.tonight.tooLate',
  no_time_away: 'player.tonight.unavailable',
  one_at_a_time: 'player.tonight.oneAtATime',
  // Bonus chips redeemed as the floor seats a member (decision 0504): staff's refusals, never a member's.
  bonus_short: 'player.tonight.unavailable',
  not_chips: 'player.tonight.unavailable',
  own_record: 'player.tonight.unavailable',
  bonus_off: 'player.tonight.unavailable',
  too_many: 'player.tonight.unavailable',
};
