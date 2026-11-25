import type { Permission } from '@rivr/contracts';
import type { MessageKey } from '@rivr/i18n';
import type { IconName } from '@rivr/ui';

/** One tab of a screen that holds others (`?tab=`): who may open it. */
export interface ScreenTab {
  readonly id: string;
  readonly label: MessageKey;
  readonly anyOf: readonly Permission[];
}

/** The count's noun in `console.rail.counts`, one and many. */
export type RailCountWords = 'requests' | 'orders' | 'idChecks' | 'tickets' | 'approvals' | 'deletions';

export interface RailEntry {
  readonly id: string;
  readonly label: MessageKey;
  readonly href: string;
  readonly icon: IconName;
  /** The staff member needs one of these to see it; a screen with tabs needs one of any tab's. */
  readonly anyOf: readonly Permission[];
  /** A screen that holds others by tab, in order, the first opened by default. */
  readonly tabs?: readonly ScreenTab[];
  /** The queues (`staff_queue_counts`) whose waiting add up to the count beside it. */
  readonly counts?: readonly string[];
  /** What the count is, when it is not people waiting (audit F-129). */
  readonly countWords?: RailCountWords;
  /** The count asks for action (requests, orders): a gold badge (decision 0463); otherwise a muted one. */
  readonly isActionable?: true;
}

export interface RailGroup {
  readonly id: string;
  readonly label: MessageKey;
  readonly entries: readonly RailEntry[];
  /** Folded under its heading until opened (Admin). */
  readonly isCollapsible?: true;
}

// The floor's seats come from reads that need members.read: without it every seat reads empty, so investors, marketing and
// dealers have no Live floor (owner, 8 Nov; audit F-004).
const FLOOR_READERS: readonly Permission[] = ['members.read', 'floor.manage', 'waitlist.manage'];

// The rail in the order of a club night (console v3, phase 1). A host has no Marketing or Admin.
export const RAIL: readonly RailGroup[] = [
  {
    id: 'tonight', label: 'console.rail.groups.tonight', entries: [
      { id: 'liveFloor', label: 'console.rail.items.liveFloor', href: '/', icon: 'floor', anyOf: FLOOR_READERS, counts: ['topUps', 'callTimeSet', 'liveFloor', 'seating'], countWords: 'requests', isActionable: true },
      { id: 'waitlist', label: 'console.rail.items.waitlist', href: '/waitlist', icon: 'waitlist', anyOf: [], counts: ['waitlist'], isActionable: true, tabs: [
        { id: 'lists', label: 'console.rail.items.lists', anyOf: ['waitlist.manage'] },
      ] },
      { id: 'door', label: 'console.rail.items.door', href: '/door', icon: 'door', anyOf: [], tabs: [
        { id: 'check-in', label: 'console.rail.items.checkIn', anyOf: ['waitlist.manage'] },
        { id: 'players', label: 'console.rail.items.todaysPlayers', anyOf: ['members.read'] },
      ] },
      { id: 'fnb', label: 'console.rail.items.fnb', href: '/fnb', icon: 'food', anyOf: ['fnb.manage', 'fnb.serve'], counts: ['fnb'], countWords: 'orders', isActionable: true },
      // Guest relations' one screen (redesign RD-32): top-up requests, tonight's and past days'. Admins, who give the role, have it too.
      { id: 'topUps', label: 'console.rail.items.topUps', href: '/top-ups', icon: 'requests', anyOf: ['top_ups.manage'], counts: ['topUps'], countWords: 'requests', isActionable: true },
    ],
  },
  {
    id: 'players', label: 'console.rail.groups.players', entries: [
      // The floor opens Members to view (members.phone: the floor and up; the owner, 22 Nov).
      { id: 'members', label: 'console.rail.items.members', href: '/members', icon: 'profile', anyOf: ['members.manage', 'host_queue.manage', 'members.phone'], counts: ['erasureRequests'], countWords: 'deletions' },
      { id: 'kycReview', label: 'console.rail.items.kycReview', href: '/kyc-review', icon: 'kyc', anyOf: ['kyc.review', 'kyc.in_person'], counts: ['kycReview'], countWords: 'idChecks' },
      { id: 'feedback', label: 'console.rail.items.feedback', href: '/feedback', icon: 'feedback', anyOf: ['feedback.manage'], counts: ['feedback'], countWords: 'tickets' },
    ],
  },
  {
    id: 'marketing', label: 'console.rail.groups.marketing', entries: [
      { id: 'promotions', label: 'console.rail.items.promotions', href: '/promotions', icon: 'promotions', anyOf: ['promotions.manage'], counts: ['promotions', 'bonusApprovals', 'visitApprovals'], countWords: 'approvals' },
      { id: 'tournaments', label: 'console.rail.items.tournaments', href: '/tournaments', icon: 'trophy', anyOf: ['tournaments.manage'] },
      { id: 'content', label: 'console.rail.items.content', href: '/content', icon: 'content', anyOf: [], tabs: [
        { id: 'website', label: 'console.rail.items.website', anyOf: ['website.edit'] },
        { id: 'app', label: 'console.rail.items.app', anyOf: ['website.edit'] },
      ] },
    ],
  },
  {
    id: 'admin', label: 'console.rail.groups.admin', isCollapsible: true, entries: [
      { id: 'tables', label: 'console.rail.items.tables', href: '/tables', icon: 'tables', anyOf: ['tables.manage'] },
      { id: 'staff', label: 'console.rail.items.staff', href: '/staff', icon: 'staff', anyOf: ['staff.manage'] },
      // The money-free Tables view (owner, 8 Nov).
      { id: 'reports', label: 'console.rail.items.reports', href: '/reports', icon: 'sessions', anyOf: ['reports.read'] },
      { id: 'settings', label: 'console.rail.items.settings', href: '/settings', icon: 'settings', anyOf: [], tabs: [
        // One row (audit F-028): the areas shown (areas.ts hides the rest), then the kinds of device.
        { id: 'floor', label: 'console.settings.areas.floor', anyOf: ['settings.manage'] },
        { id: 'members', label: 'console.settings.areas.members', anyOf: ['settings.manage'] },
        { id: 'notices', label: 'console.settings.areas.notices', anyOf: ['settings.manage'] },
        { id: 'club', label: 'console.settings.areas.club', anyOf: ['venue.configure'] },
        { id: 'tvs', label: 'console.tvs.title', anyOf: ['tvs.manage'] },
        { id: 'tablets', label: 'console.tablets.title', anyOf: ['devices.manage'] },
      ] },
      { id: 'activity', label: 'console.rail.items.activity', href: '/activity', icon: 'info', anyOf: ['activity.read'] },
    ],
  },
];

/**
 * Every request waiting on the floor, as one list (console v3, decision 0479): the phone's Requests tab. From 768 px they
 * sit beside the Live floor. Top-ups and time requests are among them, so their old addresses open it.
 */
export const REQUESTS: RailEntry = {
  id: 'requests', label: 'console.rail.items.requests', href: '/requests', icon: 'requests', anyOf: ['waitlist.manage'],
  counts: ['waitlist', 'topUps', 'callTimeSet', 'liveFloor', 'seating'], countWords: 'requests', isActionable: true,
};

/** Below 768 px, the tab bar's tabs before More: each a screen above, under a shorter name. */
export const PHONE_TABS: readonly { readonly entry: string; readonly label: MessageKey }[] = [
  { entry: 'liveFloor', label: 'console.rail.items.floor' },
  { entry: 'requests', label: 'console.rail.items.requests' },
  { entry: 'waitlist', label: 'console.rail.items.waitlist' },
  { entry: 'door', label: 'console.rail.items.door' },
];
