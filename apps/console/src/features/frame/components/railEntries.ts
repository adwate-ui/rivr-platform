import type { Permission } from '@rivr/contracts';
import type { MessageKey } from '@rivr/i18n';
import type { IconName } from '@rivr/ui';

/** One tab of a screen that holds others (`?tab=`): who may open it. */
export interface ScreenTab {
  readonly id: string;
  readonly label: MessageKey;
  readonly anyOf: readonly Permission[];
}

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
  /** The count asks for action (requests, orders): a gold badge (decision 0463); otherwise a muted one. */
  readonly isActionable?: true;
  /** Signs the staff member out after ten idle minutes (#384): members' records and documents, kill switch, purge. */
  readonly locksWhenIdle?: true;
  /** A screen that stops or destroys things: its name in the danger colour. */
  readonly tone?: 'danger';
}

export interface RailGroup {
  readonly id: string;
  readonly label: MessageKey;
  readonly entries: readonly RailEntry[];
  /** Folded under its heading until opened (Admin). */
  readonly isCollapsible?: true;
}

/** A screen hidden at the owner's word (decision 0284): never on the rail, its address refused to everyone as switched off. */
export interface HiddenScreen {
  readonly label: MessageKey;
  readonly href: string;
  readonly locksWhenIdle?: true;
}

const FLOOR_READERS: readonly Permission[] = ['members.read', 'floor.manage', 'waitlist.manage', 'hands.log', 'dashboards.read', 'promotions.manage'];

// The rail in the order of a club night (console v3, phase 1). A host has no Marketing or Admin: Rewards is for those who
// run the catalogue or give points, not for handing over (decision 0476).
export const RAIL: readonly RailGroup[] = [
  {
    id: 'tonight', label: 'console.rail.groups.tonight', entries: [
      { id: 'liveFloor', label: 'console.rail.items.liveFloor', href: '/', icon: 'floor', anyOf: FLOOR_READERS, counts: ['topUps', 'timeRequests', 'liveFloor', 'seating'], isActionable: true },
      { id: 'waitlist', label: 'console.rail.items.waitlist', href: '/waitlist', icon: 'waitlist', anyOf: [], counts: ['waitlist', 'tournamentInterest'], isActionable: true, tabs: [
        { id: 'lists', label: 'console.rail.items.lists', anyOf: ['waitlist.manage'] },
        { id: 'interest', label: 'console.rail.items.tournamentInterest', anyOf: ['tournaments.manage'] },
      ] },
      { id: 'door', label: 'console.rail.items.door', href: '/door', icon: 'door', anyOf: [], tabs: [
        { id: 'check-in', label: 'console.rail.items.checkIn', anyOf: ['waitlist.manage'] },
        { id: 'players', label: 'console.rail.items.todaysPlayers', anyOf: ['members.read'] },
        // Redemptions to hand over at the door, so a host, who has no Marketing (decision 0476), still hands them over.
        { id: 'handover', label: 'console.rail.items.handOver', anyOf: ['rewards.hand_over'] },
      ] },
      { id: 'fnb', label: 'console.rail.items.fnb', href: '/fnb', icon: 'food', anyOf: ['fnb.manage', 'fnb.serve'], counts: ['fnb'], isActionable: true },
    ],
  },
  {
    id: 'players', label: 'console.rail.groups.players', entries: [
      { id: 'members', label: 'console.rail.items.members', href: '/members', icon: 'profile', anyOf: ['members.manage', 'host_queue.manage'], locksWhenIdle: true },
      { id: 'kycReview', label: 'console.rail.items.kycReview', href: '/kyc-review', icon: 'kyc', anyOf: ['kyc.review', 'kyc.in_person'], counts: ['kycReview'], locksWhenIdle: true },
      { id: 'hostQueue', label: 'console.rail.items.hostQueue', href: '/host-queue', icon: 'phone', anyOf: ['host_queue.manage'], counts: ['hostQueue'] },
      { id: 'feedback', label: 'console.rail.items.feedback', href: '/feedback', icon: 'feedback', anyOf: ['feedback.manage'], counts: ['feedback'] },
    ],
  },
  {
    id: 'marketing', label: 'console.rail.groups.marketing', entries: [
      { id: 'promotions', label: 'console.rail.items.promotions', href: '/promotions', icon: 'promotions', anyOf: ['promotions.manage'], counts: ['promotions'] },
      { id: 'rewards', label: 'console.rail.items.rewards', href: '/rewards', icon: 'rewards', anyOf: [], counts: ['rewards'], tabs: [
        { id: 'rewards', label: 'console.rail.items.rewards', anyOf: ['rewards.manage', 'points.give'] },
        { id: 'spin-wheel', label: 'console.rail.items.spinWheel', anyOf: ['promotions.manage'] },
      ] },
      { id: 'social', label: 'console.rail.items.social', href: '/social', icon: 'social', anyOf: ['marketing.publish'] },
      { id: 'content', label: 'console.rail.items.content', href: '/content', icon: 'content', anyOf: [], tabs: [
        { id: 'website', label: 'console.rail.items.website', anyOf: ['website.edit'] },
        { id: 'learn', label: 'console.rail.items.learnContent', anyOf: ['learn.manage_sources'] },
      ] },
    ],
  },
  {
    id: 'admin', label: 'console.rail.groups.admin', isCollapsible: true, entries: [
      { id: 'staff', label: 'console.rail.items.staff', href: '/staff', icon: 'staff', anyOf: ['staff.manage'] },
      { id: 'tables', label: 'console.rail.items.tables', href: '/tables', icon: 'tables', anyOf: ['tables.manage'] },
      // The money-free Tables view (owner, 8 Nov); the money reports stay hidden.
      { id: 'reports', label: 'console.rail.items.reports', href: '/reports', icon: 'sessions', anyOf: ['reports.read'] },
      { id: 'settings', label: 'console.rail.items.settings', href: '/settings', icon: 'settings', anyOf: [], tabs: [
        { id: 'settings', label: 'console.rail.items.settings', anyOf: ['settings.manage', 'venue.configure'] },
        { id: 'devices', label: 'console.rail.items.devices', anyOf: ['devices.manage'] },
      ] },
      { id: 'killSwitch', label: 'console.rail.items.killSwitch', href: '/kill-switch', icon: 'alert', anyOf: ['control.engage'], locksWhenIdle: true, tone: 'danger' },
      { id: 'practiceReset', label: 'console.rail.items.practiceReset', href: '/practice-reset', icon: 'reset', anyOf: ['purge.run'], tone: 'danger' },
      { id: 'purge', label: 'console.rail.items.purge', href: '/purge', icon: 'purge', anyOf: ['purge.run'], locksWhenIdle: true, tone: 'danger' },
    ],
  },
];

/**
 * Every request waiting on the floor, as one list (console v3, decision 0479): the phone's Requests tab. From 768 px they
 * sit beside the Live floor. Top-ups and time requests are among them, so their old addresses open it.
 */
export const REQUESTS: RailEntry = {
  id: 'requests', label: 'console.rail.items.requests', href: '/requests', icon: 'requests', anyOf: ['waitlist.manage'],
  counts: ['waitlist', 'topUps', 'timeRequests', 'liveFloor', 'seating'], isActionable: true,
};

/** Below 768 px, the tab bar's tabs before More: each a screen above, under a shorter name. */
export const PHONE_TABS: readonly { readonly entry: string; readonly label: MessageKey }[] = [
  { entry: 'liveFloor', label: 'console.rail.items.floor' },
  { entry: 'requests', label: 'console.rail.items.requests' },
  { entry: 'waitlist', label: 'console.rail.items.waitlist' },
  { entry: 'door', label: 'console.rail.items.door' },
];

// Hidden at the owner's word (29 Oct, #626, decision 0284): no rupee, rake or reporting on any console. Each screen stays
// for when the club wants it back; the cage and money ones still lock when idle.
export const HIDDEN: readonly HiddenScreen[] = [
  { label: 'console.rail.items.overview', href: '/owner' },
  { label: 'console.rail.items.tournaments', href: '/tournaments' },
  { label: 'console.rail.items.dealers', href: '/dealers' },
  { label: 'console.rail.items.jackpots', href: '/jackpots' },
  { label: 'console.rail.items.cage', href: '/cage', locksWhenIdle: true },
  { label: 'console.rail.items.withdrawals', href: '/withdrawals', locksWhenIdle: true },
  { label: 'console.rail.items.academyPayments', href: '/academy/payments', locksWhenIdle: true },
  { label: 'console.rail.items.shift', href: '/shift', locksWhenIdle: true },
  { label: 'console.rail.items.tiers', href: '/tiers' },
  { label: 'console.rail.items.league', href: '/league' },
  { label: 'console.rail.items.events', href: '/events' },
  { label: 'console.rail.items.creators', href: '/creators' },
  { label: 'console.rail.items.academy', href: '/academy' },
  { label: 'console.rail.items.paymentAccounts', href: '/accounts', locksWhenIdle: true },
  { label: 'console.rail.items.expenses', href: '/expenses', locksWhenIdle: true },
  { label: 'console.rail.items.markers', href: '/markers', locksWhenIdle: true },
  { label: 'console.rail.items.tds', href: '/tds', locksWhenIdle: true },
  { label: 'console.rail.items.tallyExport', href: '/tally', locksWhenIdle: true },
  { label: 'console.rail.items.shareholders', href: '/shareholders' },
  { label: 'console.rail.items.aml', href: '/aml' },
  { label: 'console.rail.items.hands', href: '/pot-data' },
  { label: 'console.rail.items.roster', href: '/roster' },
  { label: 'console.rail.items.certification', href: '/certification' },
  { label: 'console.rail.items.sops', href: '/sops' },
  { label: 'console.rail.items.incidents', href: '/incidents' },
  { label: 'console.rail.items.exports', href: '/exports' },
];
