import type { CreditFailure, RepaymentFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** Why a repayment did not go through, for the cashier (#92). */
export const REPAYMENT_FAILURE_COPY: Readonly<Record<RepaymentFailure, MessageKey>> = {
  not_allowed: 'console.markers.repayNotAllowed',
  no_member: 'console.markers.repayNoMember',
  not_chips: 'console.markers.repayNotChips',
  nothing_owed: 'console.markers.repayNothingOwed',
  more_than_owed: 'console.markers.repayMoreThanOwed',
  utr_used: 'console.markers.repayUtrUsed',
  stopped: 'console.markers.repayStopped',
  paused: 'console.markers.repayPaused',
  no_shift: 'console.markers.repayNoShift',
  invalid: 'console.markers.repayInvalid',
  unavailable: 'console.markers.unavailable',
};

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
