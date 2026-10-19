import type { SeatFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** Why a seating change did not go through, for the floor. */
export const SEAT_FAILURE_COPY: Readonly<Record<SeatFailure, MessageKey>> = {
  not_allowed: 'console.liveFloor.notAllowed',
  occupied: 'console.liveFloor.occupied',
  held: 'console.liveFloor.held',
  seated: 'console.liveFloor.seated',
  kyc_needed: 'console.liveFloor.kycNeeded',
  on_break: 'console.liveFloor.onBreak',
  no_member: 'console.liveFloor.noMember',
  stopped: 'console.liveFloor.stopped',
  paused: 'console.liveFloor.paused',
  invalid: 'console.liveFloor.invalid',
  unavailable: 'console.liveFloor.unavailable',
};
