import { ROLE_PERMISSIONS } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { isAllowedAt, railFor } from './rail.ts';

const items = (permissions: Parameters<typeof railFor>[0]) => railFor(permissions).flatMap((section) => section.items.map((item) => item.href));

describe('the console rail and who may open each screen', () => {
  it('keeps a cashier out of admin screens, whether from the rail or by address', () => {
    const cashier = ROLE_PERMISSIONS.cashier;
    expect(items(cashier)).not.toEqual(expect.arrayContaining(['/staff']));
    for (const admin of ['/staff', '/dealer-pins', '/kill-switch', '/rake', '/tablets', '/tvs', '/academy']) {
      expect(isAllowedAt(cashier, admin)).toBe(false);
    }
    expect(isAllowedAt(cashier, '/cage')).toBe(true);
    // The router opens /STAFF as /staff, so the rule must too.
    expect(isAllowedAt(cashier, '/STAFF')).toBe(false);
    expect(isAllowedAt(cashier, '/Kill-Switch')).toBe(false);
  });

  it('judges a screen below another by its own entry: Academy payments is the cage\'s, the Academy is not', () => {
    expect(isAllowedAt(ROLE_PERMISSIONS.cashier, '/academy/payments')).toBe(true);
    expect(isAllowedAt(ROLE_PERMISSIONS.host, '/academy/payments')).toBe(false);
  });

  it('gives staff managers the Staff screen, and leaves screens with no rail entry open to all staff', () => {
    expect(items(ROLE_PERMISSIONS.admin)).toContain('/staff');
    expect(isAllowedAt(ROLE_PERMISSIONS.admin, '/staff')).toBe(true);
    expect(isAllowedAt(ROLE_PERMISSIONS.dealer, '/')).toBe(true);
    expect(isAllowedAt(ROLE_PERMISSIONS.dealer, '/somewhere-new')).toBe(true);
  });
});
