import type { Permission } from '@rivr/contracts';
import { t, type MessageKey } from '@rivr/i18n';
import type { SideNavSection } from '@rivr/ui';

interface RailEntry {
  readonly id: string;
  readonly label: MessageKey;
  readonly href: string;
  /** The staff member needs one of these to see it; empty means every staff member does. */
  readonly anyOf: readonly Permission[];
  /** A cage or money screen: it signs the staff member out after ten idle minutes (#384). */
  readonly locksWhenIdle?: true;
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
    entries: [{ id: 'owner', label: 'console.rail.items.overview', href: '/owner', anyOf: ['dashboards.read'] }],
  },
  {
    id: 'tonight',
    label: 'console.rail.groups.tonight',
    entries: [
      { id: 'liveFloor', label: 'console.rail.items.liveFloor', href: '/', anyOf: [] },
      { id: 'waitlist', label: 'console.rail.items.waitlist', href: '/waitlist', anyOf: ['waitlist.manage'] },
      { id: 'checkIn', label: 'console.rail.items.checkIn', href: '/check-in', anyOf: ['waitlist.manage'] },
      { id: 'tournaments', label: 'console.rail.items.tournaments', href: '/tournaments', anyOf: ['tournaments.manage', 'cage.transact'] },
      { id: 'dealers', label: 'console.rail.items.dealers', href: '/dealers', anyOf: ['floor.manage'] },
      { id: 'jackpots', label: 'console.rail.items.jackpots', href: '/jackpots', anyOf: ['jackpots.approve', 'ledger.read'] },
      { id: 'highHands', label: 'console.rail.items.highHands', href: '/high-hands', anyOf: ['jackpots.approve', 'ledger.read'] },
      { id: 'fnb', label: 'console.rail.items.fnb', href: '/fnb', anyOf: ['fnb.manage'] },
      { id: 'spinWheel', label: 'console.rail.items.spinWheel', href: '/spin-wheel', anyOf: ['floor.manage', 'promotions.manage'] },
    ],
  },
  {
    id: 'cage',
    label: 'console.rail.groups.cage',
    entries: [
      { id: 'cage', label: 'console.rail.items.cage', href: '/cage', anyOf: ['cage.transact'], locksWhenIdle: true },
      { id: 'withdrawals', label: 'console.rail.items.withdrawals', href: '/withdrawals', anyOf: ['withdrawals.approve', 'cage.second_approve'], locksWhenIdle: true },
      { id: 'academyPayments', label: 'console.rail.items.academyPayments', href: '/academy/payments', anyOf: ['cage.transact'], locksWhenIdle: true },
      { id: 'endOfDay', label: 'console.rail.items.endOfDay', href: '/end-of-day', anyOf: ['ledger.read'], locksWhenIdle: true },
    ],
  },
  {
    id: 'players',
    label: 'console.rail.groups.players',
    entries: [
      { id: 'members', label: 'console.rail.items.members', href: '/members', anyOf: ['members.read'] },
      { id: 'kycReview', label: 'console.rail.items.kycReview', href: '/kyc-review', anyOf: ['kyc.review'] },
      { id: 'hostQueue', label: 'console.rail.items.hostQueue', href: '/host-queue', anyOf: ['members.manage'] },
      { id: 'feedback', label: 'console.rail.items.feedback', href: '/feedback', anyOf: ['feedback.manage'] },
      { id: 'tiers', label: 'console.rail.items.tiers', href: '/tiers', anyOf: ['tiers.manage'] },
    ],
  },
  {
    id: 'marketing',
    label: 'console.rail.groups.marketing',
    entries: [
      { id: 'promotions', label: 'console.rail.items.promotions', href: '/promotions', anyOf: ['promotions.manage'] },
      { id: 'rewards', label: 'console.rail.items.rewards', href: '/rewards', anyOf: ['rewards.manage', 'rewards.hand_over'] },
      { id: 'league', label: 'console.rail.items.league', href: '/league', anyOf: ['rewards.manage', 'members.read'] },
      { id: 'events', label: 'console.rail.items.events', href: '/events', anyOf: ['promotions.manage'] },
      { id: 'creators', label: 'console.rail.items.creators', href: '/creators', anyOf: ['promotions.manage'] },
      { id: 'social', label: 'console.rail.items.social', href: '/social', anyOf: ['marketing.publish'] },
      { id: 'website', label: 'console.rail.items.website', href: '/website', anyOf: ['website.edit'] },
      { id: 'academy', label: 'console.rail.items.academy', href: '/academy', anyOf: ['members.manage'] },
      { id: 'learnSources', label: 'console.rail.items.learnContent', href: '/learn-sources', anyOf: ['learn.manage_sources'] },
    ],
  },
  {
    id: 'money',
    label: 'console.rail.groups.money',
    entries: [
      { id: 'treasury', label: 'console.rail.items.treasury', href: '/treasury', anyOf: ['ledger.read'], locksWhenIdle: true },
      { id: 'accounts', label: 'console.rail.items.paymentAccounts', href: '/accounts', anyOf: ['ledger.read'], locksWhenIdle: true },
      { id: 'expenses', label: 'console.rail.items.expenses', href: '/expenses', anyOf: ['cage.transact', 'treasury.manage'], locksWhenIdle: true },
      { id: 'markers', label: 'console.rail.items.markers', href: '/markers', anyOf: ['markers.manage_limits', 'markers.issue', 'ledger.read'], locksWhenIdle: true },
      { id: 'tds', label: 'console.rail.items.tds', href: '/tds', anyOf: ['ledger.read'], locksWhenIdle: true },
      { id: 'tally', label: 'console.rail.items.tallyExport', href: '/tally', anyOf: ['treasury.manage'], locksWhenIdle: true },
      { id: 'shareholders', label: 'console.rail.items.shareholders', href: '/shareholders', anyOf: ['shareholding.manage'] },
      { id: 'aml', label: 'console.rail.items.aml', href: '/aml', anyOf: ['aml.review'] },
    ],
  },
  {
    id: 'reports',
    label: 'console.rail.groups.reports',
    entries: [
      { id: 'reports', label: 'console.rail.items.reports', href: '/reports', anyOf: ['reports.read'], locksWhenIdle: true },
      { id: 'potData', label: 'console.rail.items.hands', href: '/pot-data', anyOf: ['pot_data.read'] },
    ],
  },
  {
    id: 'team',
    label: 'console.rail.groups.team',
    entries: [
      { id: 'staff', label: 'console.rail.items.staff', href: '/staff', anyOf: ['staff.manage'] },
      { id: 'dealerPins', label: 'console.rail.items.dealerPins', href: '/dealer-pins', anyOf: ['staff.manage'] },
      { id: 'roster', label: 'console.rail.items.roster', href: '/roster', anyOf: ['staff.manage'] },
      { id: 'certification', label: 'console.rail.items.certification', href: '/certification', anyOf: [] },
      { id: 'sops', label: 'console.rail.items.sops', href: '/sops', anyOf: ['sops.acknowledge', 'sops.manage'] },
      { id: 'incidents', label: 'console.rail.items.incidents', href: '/incidents', anyOf: ['incidents.log', 'sops.manage'] },
    ],
  },
  {
    id: 'admin',
    label: 'console.rail.groups.admin',
    entries: [
      { id: 'settings', label: 'console.rail.items.settings', href: '/settings', anyOf: ['settings.manage', 'venue.configure'] },
      { id: 'rake', label: 'console.rail.items.rake', href: '/rake', anyOf: ['settings.manage'] },
      { id: 'tablets', label: 'console.rail.items.tablets', href: '/tablets', anyOf: ['devices.manage'] },
      { id: 'tvs', label: 'console.rail.items.tvs', href: '/tvs', anyOf: ['devices.manage'] },
      { id: 'computers', label: 'console.rail.items.computers', href: '/computers', anyOf: ['devices.manage'] },
      { id: 'cameras', label: 'console.rail.items.cameras', href: '/cameras', anyOf: ['devices.manage'] },
      { id: 'exports', label: 'console.rail.items.exports', href: '/exports', anyOf: ['exports.full'] },
      { id: 'killSwitch', label: 'console.rail.items.killSwitch', href: '/kill-switch', anyOf: ['control.engage'] },
      { id: 'practiceReset', label: 'console.rail.items.practiceReset', href: '/practice-reset', anyOf: ['purge.run'] },
      { id: 'purge', label: 'console.rail.items.purge', href: '/purge', anyOf: ['purge.run'] },
    ],
  },
];

const isAllowed = (entry: RailEntry, permissions: readonly Permission[]) =>
  entry.anyOf.length === 0 || entry.anyOf.some((permission) => permissions.includes(permission));

/**
 * The rail for a staff member: the screens their role allows, with no empty group, and beside an entry how many
 * wait on its screen, by entry id (#317: High hands' claims).
 */
export function railFor(permissions: readonly Permission[], counts: Readonly<Record<string, number>> = {}): SideNavSection[] {
  return RAIL.map((group) => ({
    id: group.id,
    label: group.label === undefined ? undefined : t(group.label),
    items: group.entries.filter((entry) => isAllowed(entry, permissions))
      .map((entry) => ({ id: entry.id, label: t(entry.label), href: entry.href, count: counts[entry.id] })),
  })).filter((section) => section.items.length > 0);
}

/**
 * Whether a staff member may open the screen at `pathname` (#28): the rail entry it belongs to (its own,
 * or the closest one above it, so /academy/payments is the Academy payments entry) must be one their role
 * allows. A screen opened by address is held to the same rule as the rail, so a cashier who types an
 * admin screen's address gets a refusal, not the screen. Screens with no rail entry are open to all staff.
 */
export function isAllowedAt(permissions: readonly Permission[], pathname: string): boolean {
  const found = entryAt(pathname);
  return found === undefined || isAllowed(found.entry, permissions);
}

/** True on the cage and money screens, which lock after ten idle minutes (#384): marked on their own entries (#602). */
export function locksWhenIdle(pathname: string): boolean {
  return entryAt(pathname)?.entry.locksWhenIdle === true;
}

/** The rail entry the screen at `pathname` belongs to (its own, or the closest one above it), with its group. */
function entryAt(pathname: string): { entry: RailEntry; group: RailGroup } | undefined {
  // The router matches addresses whatever their case, so /RAKE is the Rake screen too.
  const path = pathname.toLowerCase();
  return RAIL.flatMap((group) => group.entries.map((entry) => ({ entry, group })))
    .filter(({ entry }) => entry.href !== '/' && (path === entry.href || path.startsWith(`${entry.href}/`)))
    .sort((a, b) => b.entry.href.length - a.entry.href.length)[0];
}

/** The rail item for the screen at `pathname`, if the rail has one. */
export function railItemAt(sections: readonly SideNavSection[], pathname: string): string | undefined {
  return sections.flatMap((section) => section.items).find((item) => item.href === pathname)?.id;
}
