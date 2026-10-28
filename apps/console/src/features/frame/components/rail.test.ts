import { ROLE_PERMISSIONS } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { isAllowedAt, locksWhenIdle, railFor } from './rail.ts';

const items = (permissions: Parameters<typeof railFor>[0]) => railFor(permissions).flatMap((section) => section.items.map((item) => item.href));

describe('the console rail and who may open each screen', () => {
  it('keeps a cashier out of admin screens, whether from the rail or by address', () => {
    const cashier = ROLE_PERMISSIONS.cashier;
    expect(items(cashier)).not.toEqual(expect.arrayContaining(['/staff']));
    for (const admin of ['/staff', '/dealer-pins', '/kill-switch', '/rake', '/tablets', '/tvs', '/computers', '/academy']) {
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

  it('shows beside an entry how many wait on its screen, and nothing beside the others', () => {
    const rail = railFor(ROLE_PERMISSIONS.admin, { highHands: 2 }).flatMap((section) => section.items);
    expect(rail.find((item) => item.id === 'highHands')?.count).toBe(2);
    expect(rail.find((item) => item.id === 'jackpots')?.count).toBeUndefined();
  });

  it('locks the same eleven cage and money screens after ten idle minutes, wherever the rail groups them', () => {
    const locked = ['/cage', '/markers', '/treasury', '/accounts', '/expenses', '/tds', '/tally', '/reports', '/end-of-day', '/withdrawals', '/academy/payments'];
    for (const screen of locked) expect(locksWhenIdle(screen)).toBe(true);
    expect(locksWhenIdle('/Markers')).toBe(true);
    const everyScreen = railFor(ROLE_PERMISSIONS.super_admin).flatMap((section) => section.items.map((item) => item.href));
    expect(everyScreen.filter((href) => locksWhenIdle(href)).sort()).toEqual([...locked].sort());
  });

  it('groups the rail by the job, with Overview first as a single link', () => {
    const rail = railFor(ROLE_PERMISSIONS.super_admin);
    expect(rail.map((section) => section.label ?? section.items[0]?.label)).toEqual(
      ['Overview', 'Tonight', 'Cage', 'Players', 'Marketing', 'Money', 'Reports', 'Team', 'Admin'],
    );
  });

  it('gives Settings to setting managers and super admins, and keeps cashiers and dealers out of it (#33)', () => {
    expect(items(ROLE_PERMISSIONS.admin)).toContain('/settings');
    expect(isAllowedAt(ROLE_PERMISSIONS.super_admin, '/settings')).toBe(true);
    expect(isAllowedAt(ROLE_PERMISSIONS.cashier, '/settings')).toBe(false);
    expect(isAllowedAt(ROLE_PERMISSIONS.dealer, '/settings')).toBe(false);
  });

  it('gives staff managers the Staff screen, and leaves screens with no rail entry open to all staff', () => {
    expect(items(ROLE_PERMISSIONS.admin)).toContain('/staff');
    expect(isAllowedAt(ROLE_PERMISSIONS.admin, '/staff')).toBe(true);
    expect(isAllowedAt(ROLE_PERMISSIONS.dealer, '/')).toBe(true);
    expect(isAllowedAt(ROLE_PERMISSIONS.dealer, '/somewhere-new')).toBe(true);
  });
});
