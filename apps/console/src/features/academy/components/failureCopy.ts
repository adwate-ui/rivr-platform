import type { AcademyStaffFailure } from '@rivr/db';
import type { MessageKey } from '@rivr/i18n';

/** What the console says for each way an Academy step can fail. */
export const FAILURE_COPY: Readonly<Record<AcademyStaffFailure, MessageKey>> = {
  no_shift: 'console.cage.noShift',
  not_allowed: 'console.academyFailures.notAllowed',
  no_member: 'console.academyFailures.noMember',
  invalid: 'console.academyFailures.invalid',
  full: 'console.academyFailures.full',
  closed: 'console.academyFailures.closed',
  no_fee: 'console.academyFailures.noFee',
  no_payment: 'console.academyFailures.noPayment',
  utr_mismatch: 'console.academyFailures.utrMismatch',
  utr_used: 'console.academyFailures.utrUsed',
  stopped: 'console.academyFailures.stopped',
  unavailable: 'console.academyFailures.unavailable',
};
