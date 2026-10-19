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
      { id: 'tablets', label: 'ui.consoleRail.items.tablets', href: '/tablets', anyOf: ['devices.manage'] },
      { id: 'tvs', label: 'ui.consoleRail.items.tvs', href: '/tvs', anyOf: ['devices.manage'] },
      { id: 'rake', label: 'ui.consoleRail.items.rake', href: '/rake', anyOf: ['settings.manage'] },
    ],
  },
  {
    id: 'money',
    label: 'ui.consoleRail.groups.money',
    entries: [{ id: 'academyPayments', label: 'ui.consoleRail.items.academyPayments', href: '/academy/payments', anyOf: ['cage.transact'] }],
  },
  {
    id: 'players',
    label: 'ui.consoleRail.groups.players',
    entries: [{ id: 'kycReview', label: 'ui.consoleRail.items.kycReview', href: '/kyc-review', anyOf: ['kyc.review'] }],
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
    entries: [{ id: 'dealerPins', label: 'ui.consoleRail.items.dealerPins', href: '/dealer-pins', anyOf: ['staff.manage'] }],
  },
];

/** The rail for a staff member: the screens their role allows, with no empty group. */
export function railFor(permissions: readonly Permission[]): SideNavSection[] {
  const allowed = (entry: RailEntry) => entry.anyOf.length === 0 || entry.anyOf.some((permission) => permissions.includes(permission));
  return RAIL.map((group) => ({
    id: group.id,
    label: t(group.label),
    items: group.entries.filter(allowed).map((entry) => ({ id: entry.id, label: t(entry.label), href: entry.href })),
  })).filter((section) => section.items.length > 0);
}

/** The rail item for the screen at `pathname`, if the rail has one. */
export function railItemAt(sections: readonly SideNavSection[], pathname: string): string | undefined {
  return sections.flatMap((section) => section.items).find((item) => item.href === pathname)?.id;
}
