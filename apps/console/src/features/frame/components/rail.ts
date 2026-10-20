import type { Permission } from '@rivr/contracts';
import { t, type MessageKey } from '@rivr/i18n';
import type { SideNavSection } from '@rivr/ui';

interface RailEntry {
  readonly id: string;
  readonly label: MessageKey;
  readonly href: string;
  /** The staff member needs one of these to see it; empty means every staff member does. */
  readonly anyOf: readonly Permission[];
}

interface RailGroup {
  readonly id: string;
  readonly label: MessageKey;
  readonly entries: readonly RailEntry[];
}

// The rail lists only screens that exist; each lane adds its entries as it builds them.
const RAIL: readonly RailGroup[] = [
  {
    id: 'floor',
    label: 'ui.consoleRail.groups.floor',
    entries: [
      { id: 'liveFloor', label: 'ui.consoleRail.items.liveFloor', href: '/', anyOf: [] },
      { id: 'waitlist', label: 'ui.consoleRail.items.waitlist', href: '/waitlist', anyOf: ['waitlist.manage'] },
      { id: 'checkIn', label: 'ui.consoleRail.items.checkIn', href: '/check-in', anyOf: ['waitlist.manage'] },
      { id: 'tablets', label: 'ui.consoleRail.items.tablets', href: '/tablets', anyOf: ['devices.manage'] },
      { id: 'tvs', label: 'ui.consoleRail.items.tvs', href: '/tvs', anyOf: ['devices.manage'] },
      { id: 'rake', label: 'ui.consoleRail.items.rake', href: '/rake', anyOf: ['settings.manage'] },
    ],
  },
  {
    id: 'money',
    label: 'ui.consoleRail.groups.money',
    entries: [
      { id: 'cage', label: 'ui.consoleRail.items.cage', href: '/cage', anyOf: ['cage.transact'] },
      { id: 'markers', label: 'ui.consoleRail.items.markers', href: '/markers', anyOf: ['markers.manage_limits', 'markers.issue', 'ledger.read'] },
      { id: 'treasury', label: 'ui.consoleRail.items.treasury', href: '/treasury', anyOf: ['ledger.read'] },
      { id: 'endOfDay', label: 'ui.consoleRail.items.endOfDay', href: '/end-of-day', anyOf: ['ledger.read'] },
      { id: 'withdrawals', label: 'ui.consoleRail.items.withdrawals', href: '/withdrawals', anyOf: ['withdrawals.approve', 'cage.second_approve'] },
      { id: 'academyPayments', label: 'ui.consoleRail.items.academyPayments', href: '/academy/payments', anyOf: ['cage.transact'] },
    ],
  },
  {
    id: 'players',
    label: 'ui.consoleRail.groups.players',
    entries: [
      { id: 'members', label: 'ui.consoleRail.items.members', href: '/members', anyOf: ['members.read'] },
      { id: 'kycReview', label: 'ui.consoleRail.items.kycReview', href: '/kyc-review', anyOf: ['kyc.review'] },
    ],
  },
  {
    id: 'growth',
    label: 'ui.consoleRail.groups.growth',
    entries: [
      { id: 'jackpots', label: 'ui.consoleRail.items.jackpots', href: '/jackpots', anyOf: ['jackpots.approve', 'ledger.read'] },
      { id: 'highHands', label: 'ui.consoleRail.items.highHands', href: '/high-hands', anyOf: ['jackpots.approve', 'ledger.read'] },
      { id: 'academy', label: 'ui.consoleRail.items.academy', href: '/academy', anyOf: ['members.manage'] },
    ],
  },
  {
    id: 'team',
    label: 'ui.consoleRail.groups.team',
    entries: [
      { id: 'staff', label: 'ui.consoleRail.items.staff', href: '/staff', anyOf: ['staff.manage'] },
      { id: 'dealerPins', label: 'ui.consoleRail.items.dealerPins', href: '/dealer-pins', anyOf: ['staff.manage'] },
      { id: 'certification', label: 'ui.consoleRail.items.certification', href: '/certification', anyOf: [] },
      { id: 'sops', label: 'ui.consoleRail.items.sops', href: '/sops', anyOf: ['sops.acknowledge', 'sops.manage'] },
      { id: 'killSwitch', label: 'ui.consoleRail.items.killSwitch', href: '/kill-switch', anyOf: ['control.engage'] },
    ],
  },
];

const isAllowed = (entry: RailEntry, permissions: readonly Permission[]) =>
  entry.anyOf.length === 0 || entry.anyOf.some((permission) => permissions.includes(permission));

/** The rail for a staff member: the screens their role allows, with no empty group. */
export function railFor(permissions: readonly Permission[]): SideNavSection[] {
  return RAIL.map((group) => ({
    id: group.id,
    label: t(group.label),
    items: group.entries.filter((entry) => isAllowed(entry, permissions)).map((entry) => ({ id: entry.id, label: t(entry.label), href: entry.href })),
  })).filter((section) => section.items.length > 0);
}

/**
 * Whether a staff member may open the screen at `pathname` (#28): the rail entry it belongs to (its own,
 * or the closest one above it, so /academy/payments is the Academy payments entry) must be one their role
 * allows. A screen opened by address is held to the same rule as the rail, so a cashier who types an
 * admin screen's address gets a refusal, not the screen. Screens with no rail entry are open to all staff.
 */
export function isAllowedAt(permissions: readonly Permission[], pathname: string): boolean {
  // The router matches addresses whatever their case, so /RAKE is the Rake screen too.
  const path = pathname.toLowerCase();
  const entries = RAIL.flatMap((group) => group.entries)
    .filter((entry) => entry.href !== '/' && (path === entry.href || path.startsWith(`${entry.href}/`)))
    .sort((a, b) => b.href.length - a.href.length);
  const entry = entries[0];
  return entry === undefined || isAllowed(entry, permissions);
}

/** The rail item for the screen at `pathname`, if the rail has one. */
export function railItemAt(sections: readonly SideNavSection[], pathname: string): string | undefined {
  return sections.flatMap((section) => section.items).find((item) => item.href === pathname)?.id;
}
