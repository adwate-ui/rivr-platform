import { ROLE_PERMISSIONS, type StaffRole } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { isAllowedAt, landingFor, locksWhenIdle, phoneTabsFor, railFor, railItemAt, refusalAt, tabsFor, URGENT_QUEUES } from './rail.ts';
import { RAIL, REQUESTS } from './railEntries.ts';

const items = (role: StaffRole) => railFor(ROLE_PERMISSIONS[role]).flatMap((section) => section.items.map((item) => item.href));
const groups = (role: StaffRole) => railFor(ROLE_PERMISSIONS[role]).map((section) => section.label);
const entry = (id: string) => [...RAIL.flatMap((group) => group.entries), REQUESTS].find((one) => one.id === id);

describe('the console rail (console v3)', () => {
  it('says what each count is: requests, open tickets, one or many (audit F-129)', () => {
    const items = railFor(['floor.manage', 'feedback.manage'], { liveFloor: 1, feedback: 183 }).flatMap((section) => section.items);
    expect(items.find((item) => item.id === 'liveFloor')?.countLabel).toBe('1 request');
    expect(items.find((item) => item.id === 'feedback')?.countLabel).toBe('183 open tickets');
  });

  it('runs Tonight, Players and Marketing, then Admin folded, for a super admin, with the three danger screens in red', () => {
    const rail = railFor(ROLE_PERMISSIONS.super_admin);
    expect(rail.map((section) => section.label)).toEqual(['Tonight', 'Players', 'Marketing', 'Admin']);
    expect(rail.map((section) => section.items.map((item) => item.label))).toEqual([
      ['Live floor', 'Waitlist', 'Door', 'Food and drink'],
      ['Members', 'ID checks', 'Host queue', 'Feedback'],
      ['Promotions', 'Rewards', 'Social', 'Content'],
      ['Staff', 'Tables', 'Reports', 'Settings', 'Activity', 'Kill switch', 'Practice reset', 'Purge'],
    ]);
    expect(rail.map((section) => section.isCollapsible === true)).toEqual([false, false, false, true]);
    const danger = rail.flatMap((section) => section.items).filter((item) => item.tone === 'danger').map((item) => item.label);
    expect(danger).toEqual(['Kill switch', 'Practice reset', 'Purge']);
    expect(rail.flatMap((section) => section.items).every((item) => item.icon.length > 0)).toBe(true);
  });

  it('gives a host no Marketing or Admin, and refuses their screens by address under their own names', () => {
    expect(groups('host')).toEqual(['Tonight', 'Players']);
    expect(items('host')).toEqual(['/', '/waitlist', '/door', '/members', '/kyc-review', '/host-queue']);
    for (const [path, title] of [['/settings', 'Settings'], ['/rewards', 'Rewards'], ['/promotions', 'Promotions'], ['/staff', 'Staff'], ['/tables', 'Tables'], ['/content', 'Content']]) {
      expect(refusalAt(ROLE_PERMISSIONS.host, path ?? '')).toEqual({ title, isOff: false });
    }
  });

  it('gives an admin Admin without the danger screens, which it refuses by address', () => {
    expect(groups('admin')).toEqual(['Tonight', 'Players', 'Marketing', 'Admin']);
    expect(railFor(ROLE_PERMISSIONS.admin).find((section) => section.label === 'Admin')?.items.map((item) => item.href)).toEqual(['/staff', '/tables', '/reports', '/settings']);
    for (const path of ['/kill-switch', '/practice-reset', '/purge']) expect(isAllowedAt(ROLE_PERMISSIONS.admin, path)).toBe(false);
    // Content is the website and Learn content: neither is an admin's.
    expect(items('admin')).not.toContain('/content');
  });

  it('gives the floor the night, ID checks in person and rewards, and no member list or admin', () => {
    expect(items('floor')).toEqual(['/', '/waitlist', '/door', '/fnb', '/kyc-review', '/rewards']);
    expect(items('cashier')).toEqual(['/', '/waitlist', '/door', '/rewards']);
    for (const kept of ['/tables', '/members', '/promotions', '/settings', '/staff']) expect(isAllowedAt(ROLE_PERMISSIONS.floor, kept)).toBe(false);
  });

  it('gives Service only food and drink, where it lands in place of the Live floor', () => {
    expect(items('service')).toEqual(['/fnb']);
    expect(isAllowedAt(ROLE_PERMISSIONS.service, '/')).toBe(false);
    expect(landingFor(railFor(ROLE_PERMISSIONS.service))?.href).toBe('/fnb');
    expect(phoneTabsFor(ROLE_PERMISSIONS.service)).toEqual([]);
  });

  it('gives marketing its own screens and a dealer and an investor none: the Live floor would read empty without members.read (audit F-004)', () => {
    expect(items('marketing')).toEqual(['/promotions', '/rewards', '/social', '/content']);
    expect(landingFor(railFor(ROLE_PERMISSIONS.marketing))?.href).toBe('/promotions');
    for (const role of ['dealer', 'owner_view'] as const) {
      expect(items(role)).toEqual([]);
      expect(landingFor(railFor(ROLE_PERMISSIONS[role]))).toBeUndefined();
      expect(isAllowedAt(ROLE_PERMISSIONS[role], '/')).toBe(false);
    }
  });

  it('keeps a cashier out of admin screens, whether from the rail or by address, whatever the case', () => {
    expect(items('cashier')).not.toContain('/staff');
    for (const admin of ['/staff', '/kill-switch', '/settings', '/tables', '/academy', '/STAFF', '/Kill-Switch']) {
      expect(isAllowedAt(ROLE_PERMISSIONS.cashier, admin)).toBe(false);
    }
    expect(isAllowedAt(ROLE_PERMISSIONS.cashier, '/')).toBe(true);
  });

  it('opens only the tabs a role has, and refuses a tab outside it by address', () => {
    const rewards = entry('rewards');
    if (rewards === undefined) throw new Error('no Rewards entry');
    expect(tabsFor(rewards, ROLE_PERMISSIONS.cashier).map((tab) => tab.id)).toEqual(['rewards', 'points']);
    expect(tabsFor(rewards, ROLE_PERMISSIONS.super_admin).map((tab) => tab.id)).toEqual(['rewards', 'points', 'spin-wheel']);
    const settings = entry('settings');
    if (settings === undefined) throw new Error('no Settings entry');
    expect(tabsFor(settings, ROLE_PERMISSIONS.super_admin).map((tab) => tab.id)).toEqual(['floor', 'members', 'notices', 'club', 'tvs', 'tablets']);
    expect(isAllowedAt(ROLE_PERMISSIONS.cashier, '/rewards', 'rewards')).toBe(true);
    expect(refusalAt(ROLE_PERMISSIONS.cashier, '/rewards', 'spin-wheel')).toEqual({ title: 'Spin wheel', isOff: false });
    expect(isAllowedAt(ROLE_PERMISSIONS.floor, '/waitlist', 'interest')).toBe(false);
    // A host has no Marketing, so hands redemptions over at the Door.
    const door = entry('door');
    if (door === undefined) throw new Error('no Door entry');
    expect(tabsFor(door, ROLE_PERMISSIONS.host).map((tab) => tab.id)).toEqual(['check-in', 'players', 'handover']);
    expect(tabsFor(door, ROLE_PERMISSIONS.service).map((tab) => tab.id)).toEqual([]);
    expect(isAllowedAt(ROLE_PERMISSIONS.admin, '/waitlist', 'interest')).toBe(true);
    // A tab the screen does not have is the screen's first: the role's, not a refusal.
    expect(isAllowedAt(ROLE_PERMISSIONS.cashier, '/rewards', 'nowhere')).toBe(true);
  });

  it('hides what the owner hid on 29 Oct from everyone, by the rail and by address, naming the screen it refuses', () => {
    const everyone = ROLE_PERMISSIONS.super_admin;
    const hidden = ['/owner', '/tournaments', '/dealers', '/jackpots', '/cage', '/withdrawals', '/academy/payments', '/shift', '/tiers', '/league',
      '/events', '/creators', '/academy', '/accounts', '/expenses', '/markers', '/tds', '/tally', '/shareholders', '/aml', '/pot-data',
      '/roster', '/certification', '/sops', '/incidents', '/exports'];
    for (const screen of hidden) {
      expect(refusalAt(everyone, screen)?.isOff).toBe(true);
      expect(items('super_admin')).not.toContain(screen);
    }
    expect(refusalAt(everyone, '/cage/receipt')).toEqual({ title: 'Cage', isOff: true });
    expect(refusalAt(everyone, '/academy')).toEqual({ title: 'Academy', isOff: true });
    expect(refusalAt(ROLE_PERMISSIONS.cashier, '/purge')).toEqual({ title: 'Purge', isOff: false });
  });

  it('leaves an address with no screen of its own, an old one that moves on, open to all staff', () => {
    for (const old of ['/check-in', '/tvs', '/somewhere-new']) expect(isAllowedAt(ROLE_PERMISSIONS.dealer, old)).toBe(true);
  });

  it('counts beside a screen what waits on it, in gold where it asks for action', () => {
    const rail = railFor(ROLE_PERMISSIONS.super_admin, { topUps: 2, timeRequests: 1, liveFloor: 3, waitlist: 4, kycReview: 2 }).flatMap((section) => section.items);
    expect(rail.find((item) => item.id === 'liveFloor')).toMatchObject({ count: 6, isActionable: true });
    expect(rail.find((item) => item.id === 'waitlist')).toMatchObject({ count: 4, isActionable: true });
    expect(rail.find((item) => item.id === 'kycReview')).toMatchObject({ count: 2, isActionable: undefined });
    expect(rail.find((item) => item.id === 'members')?.count).toBeUndefined();
  });

  it('puts Floor, Requests, Waitlist and Door on the phone tab bar, Requests counting every request', () => {
    const tabs = phoneTabsFor(ROLE_PERMISSIONS.floor, { topUps: 2, timeRequests: 1, liveFloor: 1, waitlist: 3 });
    expect(tabs.map((tab) => [tab.label, tab.href])).toEqual([['Floor', '/'], ['Requests', '/requests'], ['Waitlist', '/waitlist'], ['Door', '/door']]);
    expect(tabs.find((tab) => tab.id === 'requests')).toMatchObject({ count: 7, isActionable: true, icon: 'requests' });
  });

  it('marks the screen open now on the rail and the tab bar, by its own address', () => {
    expect(railItemAt('/')).toBe('liveFloor');
    expect(railItemAt('/door')).toBe('door');
    expect(railItemAt('/requests')).toBe('requests');
    expect(railItemAt('/kill-switch')).toBe('killSwitch');
    expect(railItemAt('/nowhere')).toBeUndefined();
  });

  it('chimes for an order its member cancelled, as the bar may hold its KOT (F-048)', () => {
    expect(URGENT_QUEUES).toContain('fnbCancelled');
  });

  it('keeps the cage and money screens locking after ten idle minutes, and none of them on the rail', () => {
    const money = ['/cage', '/markers', '/shift', '/accounts', '/expenses', '/tds', '/tally', '/withdrawals', '/academy/payments'];
    for (const screen of money) expect(locksWhenIdle(screen)).toBe(true);
    expect(locksWhenIdle('/Markers')).toBe(true);
    expect(items('super_admin').filter((href) => money.includes(href))).toEqual([]);
  });

  it("locks the rail's screens with members' records and documents, Activity, the kill switch and the purge after ten idle minutes, and no other", () => {
    expect(items('super_admin').filter((href) => locksWhenIdle(href)).sort()).toEqual(['/activity', '/kill-switch', '/kyc-review', '/members', '/purge']);
  });
});
