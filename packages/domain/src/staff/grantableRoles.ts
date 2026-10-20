import { ROLE_PERMISSIONS, STAFF_ROLES, type Permission, type StaffRole } from '@rivr/contracts/roles';

/**
 * The roles a staff member may give, as the database's private.can_grant_role decides (#28, decision
 * 0073): every role for one who configures the venue (a super admin); otherwise only a role whose every
 * permission they hold themselves, so nobody hands out more than they have.
 */
export function grantableRoles(permissions: readonly Permission[]): StaffRole[] {
  if (permissions.includes('venue.configure')) return [...STAFF_ROLES];
  return STAFF_ROLES.filter((role) => ROLE_PERMISSIONS[role].every((permission) => permissions.includes(permission)));
}
