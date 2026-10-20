import { ROLE_PERMISSIONS, STAFF_ROLES } from '@rivr/contracts/roles';
import { describe, expect, it } from 'vitest';
import { grantableRoles } from './grantableRoles.ts';

describe('grantableRoles', () => {
  it('gives a super admin every role', () => {
    expect(grantableRoles(ROLE_PERMISSIONS.super_admin)).toEqual([...STAFF_ROLES]);
  });

  it('gives an admin only roles within their own permissions: not the cage, the dealer\'s hand logging, marketing, the owner\'s view or a super admin', () => {
    expect(grantableRoles(ROLE_PERMISSIONS.admin)).toEqual(['admin', 'host']);
  });

  it('gives a cashier only a cashier, and a dealer only a dealer', () => {
    expect(grantableRoles(ROLE_PERMISSIONS.cashier)).toEqual(['cashier']);
    expect(grantableRoles(ROLE_PERMISSIONS.dealer)).toEqual(['dealer']);
  });
});
