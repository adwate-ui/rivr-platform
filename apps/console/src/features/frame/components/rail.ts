import type { Permission } from '@rivr/contracts';
import { t, type MessageKey } from '@rivr/i18n';
import type { SideNavSection } from '@rivr/ui';

interface RailEntry {
  readonly id: string;
  readonly label: MessageKey;
  readonly href: string;
  /** The staff member needs one of these to see it; empty means every staff member does. */
  readonly anyOf: readonly Permission[];
  /** Signs the staff member out after ten idle minutes (#384): cage and money screens, members' records, kill switch, purge. */
  readonly locksWhenIdle?: true;
  /**
   * Hidden at the owner's word (29 Oct, #626, decision 0284): no rupee, rake or reporting on any console. It is off the
   * rail and its address is refused, while its screen stays for when the club wants it back.
   */
  readonly hidden?: true;
}

interface RailGroup {
  readonly id: string;
  /** None for a group that is a single link, so its name does not show twice. */
  readonly label?: MessageKey;
  readonly entries: readonly RailEntry[];
}

// The rail, grouped by the job staff are doing, in the order of a club night (#602). Every screen keeps its address.
const RAIL: readonly RailGroup[] = [
  {
    id: 'overview',
    entries: [{ id: 'owner', label: 'console.rail.items.overview', href: '/owner', anyOf: ['dashboards.read'], hidden: true }],
  },
  {
    id: 'tonight',
    label: 'console.rail.groups.tonight',
    entries: [
      // Everyone but Service, which has only food and drink (#640).
      { id: 'liveFloor', label: 'console.rail.items.liveFloor', href: '/', anyOf: ['members.read', 'floor.manage', 'waitlist.manage', 'hands.log', 'dashboards.read', 'promotions.manage'] },
      { id: 'waitlist', label: 'console.rail.items.waitlist', href: '/waitlist', anyOf: ['waitlist.manage'] },
      // Top-ups on a page of their own, the waiting ones counted in red (decision 0299).
      { id: 'topUps', label: 'console.rail.items.topUps', href: '/top-ups', anyOf: ['waitlist.manage'] },
      // More call time members asked for, on a page of their own, counted in red (decision 0305).
      { id: 'timeRequests', label: 'console.rail.items.timeRequests', href: '/time-requests', anyOf: ['waitlist.manage'] },
      { id: 'checkIn', label: 'console.rail.items.checkIn', href: '/check-in', anyOf: ['waitlist.manage'] },
      { id: 'tournaments', label: 'console.rail.items.tournaments', href: '/tournaments', anyOf: ['tournaments.manage', 'cage.transact'], hidden: true },
      { id: 'dealers', label: 'console.rail.items.dealers', href: '/dealers', anyOf: ['floor.manage'], hidden: true },
      { id: 'jackpots', label: 'console.rail.items.jackpots', href: '/jackpots', anyOf: ['jackpots.approve', 'ledger.read'], hidden: true },
      // Players register interest from the app; staff who manage tournaments mark them registered once they paid (#636, #644).
      { id: 'tournamentInterest', label: 'console.rail.items.tournamentInterest', href: '/tournament-interest', anyOf: ['tournaments.manage'] },
      { id: 'fnb', label: 'console.rail.items.fnb', href: '/fnb', anyOf: ['fnb.manage', 'fnb.serve'] },
      // A bonus, so not the floor's (#644).
      { id: 'spinWheel', label: 'console.rail.items.spinWheel', href: '/spin-wheel', anyOf: ['promotions.manage'] },
    ],
  },
  {
    id: 'cage',
    label: 'console.rail.groups.cage',
    entries: [
      { id: 'cage', label: 'console.rail.items.cage', href: '/cage', anyOf: ['cage.transact'], locksWhenIdle: true, hidden: true },
      { id: 'withdrawals', label: 'console.rail.items.withdrawals', href: '/withdrawals', anyOf: ['withdrawals.approve', 'cage.second_approve'], locksWhenIdle: true, hidden: true },
      { id: 'academyPayments', label: 'console.rail.items.academyPayments', href: '/academy/payments', anyOf: ['cage.transact'], locksWhenIdle: true, hidden: true },
      { id: 'shift', label: 'console.rail.items.shift', href: '/shift', anyOf: ['ledger.read'], locksWhenIdle: true, hidden: true },
    ],
  },
  {
    id: 'players',
    label: 'console.rail.groups.players',
    entries: [
      // The member list, the CRM's link (#647): for staff who manage members and the host, not the floor or the cashier (#644).
      { id: 'members', label: 'console.rail.items.members', href: '/members', anyOf: ['members.manage', 'host_queue.manage'], locksWhenIdle: true },
      // Everyone at the club today, with their status, times and tables (#641).
      { id: 'todaysPlayers', label: 'console.rail.items.todaysPlayers', href: '/players-today', anyOf: ['members.read'] },
      { id: 'kycReview', label: 'console.rail.items.kycReview', href: '/kyc-review', anyOf: ['kyc.review', 'kyc.in_person'], locksWhenIdle: true },
      { id: 'hostQueue', label: 'console.rail.items.hostQueue', href: '/host-queue', anyOf: ['host_queue.manage'] },
      { id: 'feedback', label: 'console.rail.items.feedback', href: '/feedback', anyOf: ['feedback.manage'] },
      { id: 'tiers', label: 'console.rail.items.tiers', href: '/tiers', anyOf: ['tiers.manage'], hidden: true },
    ],
  },
  {
    id: 'marketing',
    label: 'console.rail.groups.marketing',
    entries: [
      { id: 'promotions', label: 'console.rail.items.promotions', href: '/promotions', anyOf: ['promotions.manage'] },
      { id: 'rewards', label: 'console.rail.items.rewards', href: '/rewards', anyOf: ['rewards.manage', 'rewards.hand_over', 'points.give'] },
      { id: 'league', label: 'console.rail.items.league', href: '/league', anyOf: ['rewards.manage', 'members.read'], hidden: true },
      { id: 'events', label: 'console.rail.items.events', href: '/events', anyOf: ['promotions.manage'], hidden: true },
      { id: 'creators', label: 'console.rail.items.creators', href: '/creators', anyOf: ['promotions.manage'], hidden: true },
      { id: 'social', label: 'console.rail.items.social', href: '/social', anyOf: ['marketing.publish'] },
      { id: 'website', label: 'console.rail.items.website', href: '/website', anyOf: ['website.edit'] },
      { id: 'academy', label: 'console.rail.items.academy', href: '/academy', anyOf: ['members.manage'], hidden: true },
      { id: 'learnSources', label: 'console.rail.items.learnContent', href: '/learn-sources', anyOf: ['learn.manage_sources'] },
    ],
  },
  {
    id: 'money',
    label: 'console.rail.groups.money',
    entries: [
      { id: 'accounts', label: 'console.rail.items.paymentAccounts', href: '/accounts', anyOf: ['ledger.read'], locksWhenIdle: true, hidden: true },
      { id: 'expenses', label: 'console.rail.items.expenses', href: '/expenses', anyOf: ['cage.transact', 'treasury.manage'], locksWhenIdle: true, hidden: true },
      { id: 'markers', label: 'console.rail.items.markers', href: '/markers', anyOf: ['markers.manage_limits', 'markers.issue', 'ledger.read'], locksWhenIdle: true, hidden: true },
      { id: 'tds', label: 'console.rail.items.tds', href: '/tds', anyOf: ['ledger.read'], locksWhenIdle: true, hidden: true },
      { id: 'tally', label: 'console.rail.items.tallyExport', href: '/tally', anyOf: ['treasury.manage'], locksWhenIdle: true, hidden: true },
      { id: 'shareholders', label: 'console.rail.items.shareholders', href: '/shareholders', anyOf: ['shareholding.manage'], hidden: true },
      { id: 'aml', label: 'console.rail.items.aml', href: '/aml', anyOf: ['aml.review'], hidden: true },
    ],
  },
  {
    id: 'reports',
    label: 'console.rail.groups.reports',
    entries: [
      { id: 'reports', label: 'console.rail.items.reports', href: '/reports', anyOf: ['reports.read'], locksWhenIdle: true, hidden: true },
      { id: 'potData', label: 'console.rail.items.hands', href: '/pot-data', anyOf: ['pot_data.read'], hidden: true },
    ],
  },
  {
    id: 'team',
    label: 'console.rail.groups.team',
    entries: [
      // Staff stays (#626): staff accounts, their roles and the dealers' PINs have no other home.
      { id: 'staff', label: 'console.rail.items.staff', href: '/staff', anyOf: ['staff.manage'] },
      { id: 'roster', label: 'console.rail.items.roster', href: '/roster', anyOf: ['staff.manage'], hidden: true },
      { id: 'certification', label: 'console.rail.items.certification', href: '/certification', anyOf: [], hidden: true },
      { id: 'sops', label: 'console.rail.items.sops', href: '/sops', anyOf: ['sops.acknowledge', 'sops.manage'], hidden: true },
      { id: 'incidents', label: 'console.rail.items.incidents', href: '/incidents', anyOf: ['incidents.log', 'sops.manage'], hidden: true },
    ],
  },
  {
    id: 'admin',
    label: 'console.rail.groups.admin',
    entries: [
      // The stakes and tables the club runs and the games they ran: the super admin's, not the floor's (#642, #643, #644).
      { id: 'tablesSetup', label: 'console.rail.items.tablesSetup', href: '/tables', anyOf: ['tables.manage'] },
      { id: 'gamesHistory', label: 'console.rail.items.gamesHistory', href: '/games-history', anyOf: ['tables.manage'] },
      { id: 'settings', label: 'console.rail.items.settings', href: '/settings', anyOf: ['settings.manage', 'venue.configure'] },
      { id: 'devices', label: 'console.rail.items.devices', href: '/devices', anyOf: ['devices.manage'] },
      { id: 'exports', label: 'console.rail.items.exports', href: '/exports', anyOf: ['exports.full'], hidden: true },
      { id: 'killSwitch', label: 'console.rail.items.killSwitch', href: '/kill-switch', anyOf: ['control.engage'], locksWhenIdle: true },
      { id: 'practiceReset', label: 'console.rail.items.practiceReset', href: '/practice-reset', anyOf: ['purge.run'] },
      { id: 'purge', label: 'console.rail.items.purge', href: '/purge', anyOf: ['purge.run'], locksWhenIdle: true },
    ],
  },
];

/** The queues where minutes matter, counted in red, in the tab's title and with a chime (decision 0301): the rest are gold. */
export const URGENT_QUEUES: readonly string[] = ['topUps', 'timeRequests', 'waitlist', 'fnb', 'liveFloor'];

const isAllowed = (entry: RailEntry, permissions: readonly Permission[]) =>
  entry.anyOf.length === 0 || entry.anyOf.some((permission) => permissions.includes(permission));

/**
 * The rail for a staff member: the screens their role allows, with no empty group, and beside an entry how many
 * wait on its screen, by entry id (#317: High hands' claims), red for the entries in `urgent` (decision 0299: top-ups).
 */
export function railFor(permissions: readonly Permission[], counts: Readonly<Record<string, number>> = {}, urgent: readonly string[] = []): SideNavSection[] {
  return RAIL.map((group) => ({
    id: group.id,
    label: group.label === undefined ? undefined : t(group.label),
    items: group.entries.filter((entry) => entry.hidden !== true && isAllowed(entry, permissions))
      .map((entry) => ({ id: entry.id, label: t(entry.label), href: entry.href, count: counts[entry.id], isUrgent: urgent.includes(entry.id) })),
  })).filter((section) => section.items.length > 0);
}

/**
 * Whether a staff member may open the screen at `pathname` (#28): the rail entry it belongs to (its own,
 * or the closest one above it, so /academy/payments is the Academy payments entry) must be one their role
 * allows. A screen opened by address is held to the same rule as the rail, so a cashier who types an
 * admin screen's address gets a refusal, not the screen. A hidden screen is refused to everyone (#626). Screens with no
 * rail entry are open to all staff.
 */
export function isAllowedAt(permissions: readonly Permission[], pathname: string): boolean {
  const found = entryAt(pathname);
  return found === undefined || (found.entry.hidden !== true && isAllowed(found.entry, permissions));
}

/** True at a screen the club switched off (`hidden`), so its refusal says that rather than blaming the role (C-04). */
export function isHiddenAt(pathname: string): boolean {
  return entryAt(pathname)?.entry.hidden === true;
}

/** True on the screens that lock after ten idle minutes (#384): marked on their own entries (#602). */
export function locksWhenIdle(pathname: string): boolean {
  return entryAt(pathname)?.entry.locksWhenIdle === true;
}

/** The rail entry the screen at `pathname` belongs to (its own, or the closest one above it), with its group. */
function entryAt(pathname: string): { entry: RailEntry; group: RailGroup } | undefined {
  // The router matches addresses whatever their case, so /RAKE is the Rake screen too.
  const path = pathname.toLowerCase();
  return RAIL.flatMap((group) => group.entries.map((entry) => ({ entry, group })))
    // The Live floor is `/` itself, not every address below it (#640: Service has no Live floor).
    .filter(({ entry }) => (entry.href === '/' ? path === '/' : path === entry.href || path.startsWith(`${entry.href}/`)))
    .sort((a, b) => b.entry.href.length - a.entry.href.length)[0];
}

/** Where a staff member whose role cannot open the Live floor lands: the first screen their rail shows (#640: Service). */
export function landingFor(sections: readonly SideNavSection[]): string | undefined {
  return sections.flatMap((section) => section.items)[0]?.href;
}

/** The rail item for the screen at `pathname`, if the rail has one. */
export function railItemAt(sections: readonly SideNavSection[], pathname: string): string | undefined {
  return sections.flatMap((section) => section.items).find((item) => item.href === pathname)?.id;
}
