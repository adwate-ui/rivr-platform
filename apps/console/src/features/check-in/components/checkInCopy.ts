import type { CheckInFailure, CheckOutFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** Why a member was not checked in, for the front desk. */
export const CHECK_IN_FAILURE_COPY: Readonly<Record<CheckInFailure, MessageKey>> = {
  not_allowed: 'console.checkIn.notAllowed',
  no_member: 'console.checkIn.noMember',
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
  call_time_owed: 'console.checkIn.callTimeOwed',
  unavailable: 'console.checkIn.unavailable',
};
