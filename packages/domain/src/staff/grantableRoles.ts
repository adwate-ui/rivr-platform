import { ROLE_PERMISSIONS, STAFF_ROLES, type Permission, type StaffRole } from '@rivr/contracts/roles';

// Roles that move the venue's money, give a second approval or stop the venue: a super admin's to give (B3), so nobody
// makes themselves a second login to approve their own request.
const DUAL_CONTROL: readonly Permission[] = ['treasury.manage', 'cage.second_approve', 'control.engage'];

/**
 * The roles a staff member may give, as the database's private.can_grant_role decides (#28, decision
 * 0073): every role for one who configures the venue (a super admin); otherwise only a role whose every
 * permission they hold themselves and that holds none of the dual-control permissions.
 */
export function grantableRoles(permissions: readonly Permission[]): StaffRole[] {
  if (permissions.includes('venue.configure')) return [...STAFF_ROLES];
  return STAFF_ROLES.filter((role) => ROLE_PERMISSIONS[role].every((permission) => permissions.includes(permission))
    && !ROLE_PERMISSIONS[role].some((permission) => DUAL_CONTROL.includes(permission)));
}
