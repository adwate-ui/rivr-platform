import { ROLE_PERMISSIONS, type StaffRole } from '@rivr/contracts';
import { describe, expect, it } from 'vitest';
import { isAllowedAt, landingFor, phoneTabsFor, railFor, railItemAt, refusalAt, tabsFor, titleCountOf, URGENT_QUEUES } from './rail.ts';
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

  it('shows guest relations top-up requests and nothing else, which is where they land (redesign RD-32)', () => {
    const rail = railFor(ROLE_PERMISSIONS.guest_relations, { topUps: 2, waitlist: 4 });
    expect(rail.map((section) => section.items.map((item) => [item.label, item.count]))).toEqual([[['Top-ups', 2]]]);
    expect(landingFor(rail)?.href).toBe('/top-ups');
    expect(isAllowedAt(ROLE_PERMISSIONS.guest_relations, '/top-ups')).toBe(true);
    for (const elsewhere of ['/', '/requests', '/waitlist', '/door', '/members', '/fnb', '/staff', '/settings']) expect(isAllowedAt(ROLE_PERMISSIONS.guest_relations, elsewhere)).toBe(false);
    expect(phoneTabsFor(ROLE_PERMISSIONS.guest_relations)).toEqual([]);
    // The floor, who have top-ups among their Requests, get no second entry for them.
    expect(railFor(ROLE_PERMISSIONS.floor).flatMap((section) => section.items.map((item) => item.label))).not.toContain('Top-ups');
  });

  it('runs Tonight, Players and Marketing, then Admin folded, for a super admin', () => {
    const rail = railFor(ROLE_PERMISSIONS.super_admin);
    expect(rail.map((section) => section.label)).toEqual(['Tonight', 'Players', 'Marketing', 'Admin']);
    expect(rail.map((section) => section.items.map((item) => item.label))).toEqual([
      ['Live floor', 'Waitlist', 'Door', 'Food and drink', 'Top-ups'],
      ['Members', 'ID checks', 'Feedback'],
      ['Promotions', 'Tournaments', 'Content'],
      ['Tables', 'Staff', 'Reports', 'Settings', 'Activity'],
    ]);
    expect(rail.map((section) => section.isCollapsible === true)).toEqual([false, false, false, true]);
    expect(rail.flatMap((section) => section.items).every((item) => item.icon.length > 0)).toBe(true);
  });

  it('gives a host no Marketing or Admin, and refuses their screens by address under their own names', () => {
    expect(groups('host')).toEqual(['Tonight', 'Players']);
    expect(items('host')).toEqual(['/', '/waitlist', '/door', '/members', '/kyc-review']);
    for (const [path, title] of [['/settings', 'Settings'], ['/promotions', 'Promotions'], ['/staff', 'Staff'], ['/tables', 'Tables'], ['/content', 'Content']]) {
      expect(refusalAt(ROLE_PERMISSIONS.host, path ?? '')).toEqual({ title });
    }
  });

  it('gives an admin Admin without Activity, which it refuses by address', () => {
    expect(groups('admin')).toEqual(['Tonight', 'Players', 'Marketing', 'Admin']);
    expect(railFor(ROLE_PERMISSIONS.admin).find((section) => section.label === 'Admin')?.items.map((item) => item.href)).toEqual(['/tables', '/staff', '/reports', '/settings']);
    expect(isAllowedAt(ROLE_PERMISSIONS.admin, '/activity')).toBe(false);
    // Content is the website, which is not an admin's.
    expect(items('admin')).not.toContain('/content');
  });

  it('gives the floor the night, Members to view (the owner, 22 Nov), ID checks in person and TVs, and no other admin screen', () => {
    expect(items('floor')).toEqual(['/', '/waitlist', '/door', '/fnb', '/members', '/kyc-review', '/settings']);
    // A cashier views Members too (the owner, 22 Nov).
    expect(items('cashier')).toEqual(['/', '/waitlist', '/door', '/members', '/settings']);
    for (const kept of ['/tables', '/promotions', '/staff']) expect(isAllowedAt(ROLE_PERMISSIONS.floor, kept)).toBe(false);
    // Settings holds only its TVs tab for them (the owner, 3 Nov).
    expect(isAllowedAt(ROLE_PERMISSIONS.floor, '/settings', 'floor')).toBe(false);
  });

  it('gives Service only food and drink, where it lands in place of the Live floor', () => {
    expect(items('service')).toEqual(['/fnb']);
    expect(isAllowedAt(ROLE_PERMISSIONS.service, '/')).toBe(false);
    expect(landingFor(railFor(ROLE_PERMISSIONS.service))?.href).toBe('/fnb');
    expect(phoneTabsFor(ROLE_PERMISSIONS.service)).toEqual([]);
  });

  it('gives marketing its own screens and a dealer and an investor none: the Live floor would read empty without members.read (audit F-004)', () => {
    expect(items('marketing')).toEqual(['/promotions', '/content']);
    expect(landingFor(railFor(ROLE_PERMISSIONS.marketing))?.href).toBe('/promotions');
    for (const role of ['dealer', 'owner_view'] as const) {
      expect(items(role)).toEqual([]);
      expect(landingFor(railFor(ROLE_PERMISSIONS[role]))).toBeUndefined();
      expect(isAllowedAt(ROLE_PERMISSIONS[role], '/')).toBe(false);
    }
  });

  it('keeps a cashier out of admin screens but TVs, whether from the rail or by address, whatever the case', () => {
    expect(items('cashier')).not.toContain('/staff');
    for (const admin of ['/staff', '/activity', '/tables', '/STAFF', '/Activity']) {
      expect(isAllowedAt(ROLE_PERMISSIONS.cashier, admin)).toBe(false);
    }
    expect(isAllowedAt(ROLE_PERMISSIONS.cashier, '/settings', 'members')).toBe(false);
    expect(isAllowedAt(ROLE_PERMISSIONS.cashier, '/')).toBe(true);
  });

  it('opens only the tabs a role has, and refuses a tab outside it by address', () => {
    const settings = entry('settings');
    if (settings === undefined) throw new Error('no Settings entry');
    expect(tabsFor(settings, ROLE_PERMISSIONS.super_admin).map((tab) => tab.id)).toEqual(['floor', 'members', 'notices', 'club', 'tvs', 'tablets']);
    expect(tabsFor(settings, ROLE_PERMISSIONS.floor).map((tab) => tab.id)).toEqual(['tvs']);
    expect(tabsFor(settings, ROLE_PERMISSIONS.cashier).map((tab) => tab.id)).toEqual(['tvs']);
    expect(tabsFor(settings, ROLE_PERMISSIONS.host)).toEqual([]);
    expect(isAllowedAt(ROLE_PERMISSIONS.floor, '/tournaments')).toBe(false);
    const door = entry('door');
    if (door === undefined) throw new Error('no Door entry');
    expect(tabsFor(door, ROLE_PERMISSIONS.host).map((tab) => tab.id)).toEqual(['check-in', 'players']);
    // The floor reads Today's players, with each member's number (the owner, 15 Nov night; pgTAP 501).
    expect(tabsFor(door, ROLE_PERMISSIONS.floor).map((tab) => tab.id)).toEqual(['check-in', 'players']);
    expect(tabsFor(door, ROLE_PERMISSIONS.service).map((tab) => tab.id)).toEqual([]);
    expect(isAllowedAt(ROLE_PERMISSIONS.admin, '/tournaments')).toBe(true);
    // A tab the screen does not have is the screen's first: the role's, not a refusal.
    expect(isAllowedAt(ROLE_PERMISSIONS.cashier, '/settings', 'nowhere')).toBe(true);
  });

  it('keeps no entry for a screen the redesign removed: its address is the not-found screen for everyone, and nothing on the rail', () => {
    for (const screen of ['/cage', '/kill-switch', '/purge', '/social', '/host-queue', '/practice-reset']) {
      expect(refusalAt(ROLE_PERMISSIONS.dealer, screen)).toBeUndefined();
      expect(items('super_admin')).not.toContain(screen);
    }
    expect(refusalAt(ROLE_PERMISSIONS.cashier, '/activity')).toEqual({ title: 'Activity' });
  });

  it('leaves an address with no screen of its own, an old one that moves on, open to all staff', () => {
    for (const old of ['/check-in', '/tvs', '/somewhere-new']) expect(isAllowedAt(ROLE_PERMISSIONS.dealer, old)).toBe(true);
  });

  it('counts beside a screen what waits on it, in gold where it asks for action', () => {
    const rail = railFor(ROLE_PERMISSIONS.super_admin, { topUps: 2, callTimeSet: 1, liveFloor: 3, waitlist: 4, kycReview: 2, erasureRequests: 1 }).flatMap((section) => section.items);
    // A member's call time set waits in Requests until seen (#1090): it chimes and counts like any request.
    expect(URGENT_QUEUES).toContain('callTimeSet');
    expect(titleCountOf({ topUps: 2, callTimeSet: 1, waitlist: 4 })).toBe(7);
    expect(titleCountOf(null)).toBe(0);
    expect(rail.find((item) => item.id === 'liveFloor')).toMatchObject({ count: 6, isActionable: true });
    expect(rail.find((item) => item.id === 'waitlist')).toMatchObject({ count: 4, isActionable: true });
    expect(rail.find((item) => item.id === 'kycReview')).toMatchObject({ count: 2, isActionable: undefined });
    expect(rail.find((item) => item.id === 'members')).toMatchObject({ count: 1, isActionable: undefined });
    expect(rail.find((item) => item.id === 'content')?.count).toBeUndefined();
  });

  it('puts Floor, Requests, Waitlist and Door on the phone tab bar, Requests counting every request', () => {
    const tabs = phoneTabsFor(ROLE_PERMISSIONS.floor, { topUps: 2, callTimeSet: 1, liveFloor: 1, waitlist: 3 });
    expect(tabs.map((tab) => [tab.label, tab.href])).toEqual([['Floor', '/'], ['Requests', '/requests'], ['Waitlist', '/waitlist'], ['Door', '/door']]);
    expect(tabs.find((tab) => tab.id === 'requests')).toMatchObject({ count: 7, isActionable: true, icon: 'requests' });
  });

  it('marks the screen open now on the rail and the tab bar, by its own address', () => {
    expect(railItemAt('/')).toBe('liveFloor');
    expect(railItemAt('/door')).toBe('door');
    expect(railItemAt('/requests')).toBe('requests');
    expect(railItemAt('/activity')).toBe('activity');
    expect(railItemAt('/nowhere')).toBeUndefined();
  });

  it('chimes for an order its member cancelled, as the bar may hold its KOT (F-048)', () => {
    expect(URGENT_QUEUES).toContain('fnbCancelled');
  });
});
