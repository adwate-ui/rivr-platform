import type { CreditFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** Why a credit limit did not go through, for the floor. */
export const CREDIT_FAILURE_COPY: Readonly<Record<CreditFailure, MessageKey>> = {
  not_allowed: 'console.markers.notAllowedAction',
  no_member: 'console.markers.noMember',
  kyc_needed: 'console.markers.kycNeeded',
  too_few_visits: 'console.markers.tooFewVisits',
  not_chips: 'console.markers.notChips',
  switched_off: 'console.markers.switchedOff',
  stopped: 'console.markers.stopped',
  paused: 'console.markers.paused',
  changed: 'console.markers.changed',
  not_set_up: 'console.markers.notSetUp',
  invalid: 'console.markers.invalid',
  unavailable: 'console.markers.unavailable',
};
