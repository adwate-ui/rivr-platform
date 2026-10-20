import type { StaffRole } from '@rivr/contracts';
import type { StaffFailure } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';

/** What the Staff screen says when adding or changing staff did not go through. */
export const STAFF_FAILURE_COPY: Readonly<Record<StaffFailure, MessageKey>> = {
  not_allowed: 'console.staff.notAllowedAction',
  already_staff: 'console.staff.alreadyStaff',
  own_change: 'console.staff.ownChange',
  last_super_admins: 'console.staff.lastSuperAdmins',
  invalid: 'console.staff.changed',
  unavailable: 'console.staff.unavailable',
};

/** A role as the screen names it. */
export function roleName(role: StaffRole): string {
  return t(`console.staff.roles.${role}`);
}
