import { ROLE_PERMISSIONS } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { isAllowedAt, locksWhenIdle, railFor } from './rail.ts';

const items = (permissions: Parameters<typeof railFor>[0]) => railFor(permissions).flatMap((section) => section.items.map((item) => item.href));

describe('the console rail and who may open each screen', () => {
  it('keeps a cashier out of admin screens, whether from the rail or by address', () => {
    const cashier = ROLE_PERMISSIONS.cashier;
    expect(items(cashier)).not.toEqual(expect.arrayContaining(['/staff']));
    for (const admin of ['/staff', '/kill-switch', '/settings', '/devices', '/academy']) {
      expect(isAllowedAt(cashier, admin)).toBe(false);
    }
    expect(isAllowedAt(cashier, '/')).toBe(true);
    // The router opens /STAFF as /staff, so the rule must too.
    expect(isAllowedAt(cashier, '/STAFF')).toBe(false);
    expect(isAllowedAt(cashier, '/Kill-Switch')).toBe(false);
  });

  it('hides what the owner hid on 29 Oct from everyone, a super admin too, by the rail and by address', () => {
    const everyone = ROLE_PERMISSIONS.super_admin;
    const hidden = ['/owner', '/tournaments', '/dealers', '/jackpots', '/cage', '/withdrawals', '/academy/payments', '/shift', '/tiers', '/league',
      '/events', '/creators', '/academy', '/accounts', '/expenses', '/markers', '/tds', '/tally', '/shareholders', '/aml', '/reports', '/pot-data',
      '/roster', '/certification', '/sops', '/incidents', '/exports'];
    const onTheRail = items(everyone);
    for (const screen of hidden) {
      expect(isAllowedAt(everyone, screen)).toBe(false);
      expect(onTheRail).not.toContain(screen);
    }
    // A screen below a hidden one is hidden with it.
    expect(isAllowedAt(everyone, '/cage/receipt')).toBe(false);
    for (const kept of ['/', '/waitlist', '/check-in', '/fnb', '/members', '/promotions', '/rewards', '/staff', '/settings', '/devices']) {
      expect(isAllowedAt(everyone, kept)).toBe(true);
    }
  });

  it('shows beside an entry how many wait on its screen, and nothing beside the others', () => {
    const rail = railFor(ROLE_PERMISSIONS.super_admin, { kycReview: 2 }).flatMap((section) => section.items);
    expect(rail.find((item) => item.id === 'kycReview')?.count).toBe(2);
    expect(rail.find((item) => item.id === 'members')?.count).toBeUndefined();
  });

  it('keeps the cage and money screens locking after ten idle minutes, and none of them on the rail', () => {
    const locked = ['/cage', '/markers', '/shift', '/accounts', '/expenses', '/tds', '/tally', '/reports', '/withdrawals', '/academy/payments'];
    for (const screen of locked) expect(locksWhenIdle(screen)).toBe(true);
    expect(locksWhenIdle('/Markers')).toBe(true);
    const everyScreen = railFor(ROLE_PERMISSIONS.super_admin).flatMap((section) => section.items.map((item) => item.href));
    expect(everyScreen.filter((href) => locksWhenIdle(href))).toEqual([]);
  });

  it('groups the rail by the job, with no Overview, Cage, Money or Reports', () => {
    const rail = railFor(ROLE_PERMISSIONS.super_admin);
    expect(rail.map((section) => section.label ?? section.items[0]?.label)).toEqual(['Tonight', 'Players', 'Marketing', 'Team', 'Admin']);
    expect(rail.find((section) => section.label === 'Team')?.items.map((item) => item.href)).toEqual(['/staff']);
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
