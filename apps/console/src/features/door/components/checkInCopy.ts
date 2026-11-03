import type { CheckInFailure, CheckOutFailure, CheckOutRefusal } from '@rivr/db';
import { formatDuration, t, type MessageKey } from '@rivr/i18n';

/** Why a member was not checked in, for the front desk. */
export const CHECK_IN_FAILURE_COPY: Readonly<Record<CheckInFailure, MessageKey>> = {
  not_allowed: 'console.checkIn.notAllowed',
  no_member: 'console.checkIn.noMember',
  card_not_current: 'console.checkIn.cardNotCurrent',
  on_break: 'console.checkIn.onBreak',
  stopped: 'console.checkIn.stopped',
  paused: 'console.checkIn.paused',
  unavailable: 'console.checkIn.unavailable',
};

/** Why a member was not checked out (#82), for the front desk. */
export const CHECK_OUT_FAILURE_COPY: Readonly<Record<CheckOutFailure, MessageKey>> = {
  not_allowed: 'console.checkIn.notAllowed',
  no_member: 'console.checkIn.noMember',
  not_in_room: 'console.checkIn.notInRoom',
  seated: 'console.checkIn.stillSeated',
  call_time_owed: 'console.checkIn.callTimeOwed',
  stopped: 'console.checkIn.stopped',
  paused: 'console.checkIn.checkOutPaused',
  unavailable: 'console.checkIn.unavailable',
};

/** A refused check-out in words, with the call time still owed. */
export function checkOutRefusalText(refusal: CheckOutRefusal): string {
  return t(CHECK_OUT_FAILURE_COPY[refusal.reason], { time: formatDuration(refusal.owedSeconds) });
}
