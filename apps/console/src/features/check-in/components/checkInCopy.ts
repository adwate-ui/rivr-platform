import type { CheckInFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

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
