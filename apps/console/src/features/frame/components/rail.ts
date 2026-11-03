import type { Permission } from '@rivr/contracts';
import { t, type MessageKey } from '@rivr/i18n';
import type { SideNavItem, SideNavSection } from '@rivr/ui';
import { HIDDEN, PHONE_TABS, RAIL, REQUESTS, type RailEntry, type ScreenTab } from './railEntries.ts';

export type { ScreenTab } from './railEntries.ts';

/** How many wait in each queue, by `staff_queue_counts`'s name. */
export type QueueCounts = Readonly<Record<string, number>>;

/** The queues where minutes matter: they chime, and the tab's title counts them (decision 0301). */
export const URGENT_QUEUES: readonly string[] = ['topUps', 'timeRequests', 'waitlist', 'fnb', 'liveFloor'];

const ENTRIES: readonly RailEntry[] = [...RAIL.flatMap((group) => group.entries), REQUESTS];

const holdsAny = (anyOf: readonly Permission[], permissions: readonly Permission[]) =>
  anyOf.length === 0 || anyOf.some((permission) => permissions.includes(permission));

/** The tabs of a screen the staff member may open, in order; empty for a screen without tabs. */
export function tabsFor(entry: RailEntry, permissions: readonly Permission[]): readonly ScreenTab[] {
  return (entry.tabs ?? []).filter((tab) => tab.anyOf.length > 0 && holdsAny(tab.anyOf, permissions));
}

/** A screen with tabs opens for anyone who may open one of them; any other, for its own permissions. */
const mayOpen = (entry: RailEntry, permissions: readonly Permission[]) =>
  entry.tabs === undefined ? holdsAny(entry.anyOf, permissions) : tabsFor(entry, permissions).length > 0;

const countOf = (entry: RailEntry, counts: QueueCounts) =>
  entry.counts === undefined ? undefined : entry.counts.reduce((sum, queue) => sum + (counts[queue] ?? 0), 0);

function itemOf(entry: RailEntry, counts: QueueCounts, label: MessageKey = entry.label): SideNavItem {
  return {
    id: entry.id, label: t(label), href: entry.href, icon: entry.icon, count: countOf(entry, counts),
    isActionable: entry.isActionable, tone: entry.tone,
  };
}

/**
 * The rail for a staff member (console v3): Tonight, Players and Marketing, then Admin folded, each with only the
 * screens their role opens and no empty group; beside a screen how many wait on it, in gold where it asks for action.
 */
export function railFor(permissions: readonly Permission[], counts: QueueCounts = {}): SideNavSection[] {
  return RAIL.map((group) => ({
    id: group.id,
    label: t(group.label),
    isCollapsible: group.isCollapsible,
    items: group.entries.filter((entry) => mayOpen(entry, permissions)).map((entry) => itemOf(entry, counts)),
  })).filter((section) => section.items.length > 0);
}

/** Below 768 px, the tab bar's tabs the role opens: Floor, Requests, Waitlist, Door. More, which the shell adds, holds the rest. */
export function phoneTabsFor(permissions: readonly Permission[], counts: QueueCounts = {}): SideNavItem[] {
  return PHONE_TABS.flatMap(({ entry: id, label }) => {
    const entry = ENTRIES.find((one) => one.id === id);
    return entry !== undefined && mayOpen(entry, permissions) ? [itemOf(entry, counts, label)] : [];
  });
}

/** The screen at `pathname`: its own entry, or the closest one above it. The router matches any case, so must this. */
function entryAt(pathname: string): RailEntry | undefined {
  const path = pathname.toLowerCase();
  // The Live floor is `/` itself, not every address below it (#640: Service has no Live floor).
  const under = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(`${href}/`));
  return ENTRIES.filter((entry) => under(entry.href)).sort((a, b) => b.href.length - a.href.length)[0];
}

function hiddenAt(pathname: string) {
  const path = pathname.toLowerCase();
  return HIDDEN.find((screen) => path === screen.href || path.startsWith(`${screen.href}/`));
}

/** Why a screen is refused, and its name for the refusal's title (#811): switched off for everyone, or outside the role. */
export interface Refusal {
  readonly title: string;
  readonly isOff: boolean;
}

/**
 * Whether a staff member may open the screen at `pathname`, and the tab `tab` of it, held to the same rule as the rail
 * (#28): a cashier who types an admin screen's address is refused, and so is a host who types a tab outside the role. A
 * hidden screen, and any below it, is refused to everyone (#626). An address with no entry, such as an old one that
 * moves on, is open to all staff.
 */
export function refusalAt(permissions: readonly Permission[], pathname: string, tab?: string): Refusal | undefined {
  const hidden = hiddenAt(pathname);
  if (hidden !== undefined) return { title: t(hidden.label), isOff: true };
  const entry = entryAt(pathname);
  if (entry === undefined) return undefined;
  const named = entry.tabs?.find((one) => one.id === tab);
  const isAllowed = named === undefined ? mayOpen(entry, permissions) : holdsAny(named.anyOf, permissions);
  return isAllowed ? undefined : { title: t(entry.label), isOff: false };
}

/** True when `refusalAt` lets the staff member in. */
export function isAllowedAt(permissions: readonly Permission[], pathname: string, tab?: string): boolean {
  return refusalAt(permissions, pathname, tab) === undefined;
}

/** True on the screens that lock after ten idle minutes (#384), hidden ones too. */
export function locksWhenIdle(pathname: string): boolean {
  return (hiddenAt(pathname)?.locksWhenIdle ?? entryAt(pathname)?.locksWhenIdle) === true;
}

/** Where a staff member whose role cannot open the Live floor lands: the first screen their rail shows (#640: Service). */
export function landingFor(sections: readonly SideNavSection[]): string | undefined {
  return sections.flatMap((section) => section.items)[0]?.href;
}

/** The rail's (or the tab bar's) item for the screen at `pathname`, so the screen's own address marks it current. */
export function railItemAt(pathname: string): string | undefined {
  return entryAt(pathname)?.id;
}

/** The screen with tabs whose entry has this id, for the screen's own tab bar. */
export function screenWithTabs(id: string): RailEntry | undefined {
  return ENTRIES.find((entry) => entry.id === id && entry.tabs !== undefined);
}
