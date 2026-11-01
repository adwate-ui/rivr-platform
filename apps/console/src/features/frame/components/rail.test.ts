import { ROLE_PERMISSIONS } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { isAllowedAt, landingFor, locksWhenIdle, railFor } from './rail.ts';

const items = (permissions: Parameters<typeof railFor>[0]) => railFor(permissions).flatMap((section) => section.items.map((item) => item.href));

describe('the console rail and who may open each screen', () => {
  it('keeps a cashier out of admin screens, whether from the rail or by address', () => {
    const cashier = ROLE_PERMISSIONS.cashier;
    expect(items(cashier)).not.toEqual(expect.arrayContaining(['/staff']));
    for (const admin of ['/staff', '/kill-switch', '/settings', '/devices', '/tables', '/academy']) {
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

  it('gives Service only food and drink, where it lands in place of the Live floor', () => {
    const service = ROLE_PERMISSIONS.service;
    expect(items(service)).toEqual(['/fnb']);
    expect(isAllowedAt(service, '/')).toBe(false);
    expect(landingFor(railFor(service))).toBe('/fnb');
    expect(isAllowedAt(ROLE_PERMISSIONS.cashier, '/players-today')).toBe(true);
  });

  it('gives Floor every super admin module but tables setup, the member list, games history, tournaments and bonus', () => {
    const floor = ROLE_PERMISSIONS.floor;
    expect(items(floor)).toEqual(['/', '/waitlist', '/check-in', '/fnb', '/players-today', '/rewards']);
    // Devices waits for a TV-only permission: devices.manage also enrols the cage's computers.
    for (const kept of ['/tables', '/members', '/games-history', '/tournament-interest', '/promotions', '/spin-wheel', '/devices']) {
      expect(isAllowedAt(floor, kept)).toBe(false);
      expect(isAllowedAt(ROLE_PERMISSIONS.super_admin, kept)).toBe(true);
    }
  });

  it('gives Cashier the same as Floor, less the food and drink orders', () => {
    expect(items(ROLE_PERMISSIONS.cashier)).toEqual(['/', '/waitlist', '/check-in', '/players-today', '/rewards']);
  });

  it('shows beside an entry how many wait on its screen, and nothing beside the others', () => {
    const rail = railFor(ROLE_PERMISSIONS.super_admin, { kycReview: 2 }).flatMap((section) => section.items);
    expect(rail.find((item) => item.id === 'kycReview')?.count).toBe(2);
    expect(rail.find((item) => item.id === 'members')?.count).toBeUndefined();
  });

  it('keeps the cage and money screens locking after ten idle minutes, and none of them on the rail', () => {
    const money = ['/cage', '/markers', '/shift', '/accounts', '/expenses', '/tds', '/tally', '/reports', '/withdrawals', '/academy/payments'];
    for (const screen of money) expect(locksWhenIdle(screen)).toBe(true);
    expect(locksWhenIdle('/Markers')).toBe(true);
    const everyScreen = railFor(ROLE_PERMISSIONS.super_admin).flatMap((section) => section.items.map((item) => item.href));
    expect(everyScreen.filter((href) => money.includes(href))).toEqual([]);
  });

  it("locks the rail's screens with members' records and documents, the kill switch and the purge after ten idle minutes, and no other", () => {
    const everyScreen = railFor(ROLE_PERMISSIONS.super_admin).flatMap((section) => section.items.map((item) => item.href));
    expect(everyScreen.filter((href) => locksWhenIdle(href)).sort()).toEqual(['/kill-switch', '/kyc-review', '/members', '/purge']);
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
