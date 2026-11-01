import { ROLE_PERMISSIONS, STAFF_ROLES } from '@rivr/contracts/roles';
import { describe, expect, it } from 'vitest';
import { grantableRoles } from './grantableRoles.ts';

describe('grantableRoles', () => {
  it('gives a super admin every role', () => {
    expect(grantableRoles(ROLE_PERMISSIONS.super_admin)).toEqual([...STAFF_ROLES]);
  });

  it('gives an admin only roles within their own permissions: not the cage, the dealer\'s hand logging, marketing, the owner\'s view or a super admin', () => {
    // Service holds only food and drink (#640), which an admin holds too. Not another admin: a role that moves money or
    // gives a second approval is a super admin's to give.
    expect(grantableRoles(ROLE_PERMISSIONS.admin)).toEqual(['host', 'service', 'floor']);
  });

  it('gives a cashier no cashier, which gives a second approval, and a dealer only a dealer', () => {
    expect(grantableRoles(ROLE_PERMISSIONS.cashier)).toEqual([]);
    expect(grantableRoles(ROLE_PERMISSIONS.dealer)).toEqual(['dealer']);
  });
});
