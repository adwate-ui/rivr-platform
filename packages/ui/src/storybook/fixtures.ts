/**
 * Sample navigation for stories: the console rail and the player tabs as the design prompt
 * lists them. Apps build their own from their routes and the signed-in role.
 */
import { consoleApp, registerMessages, t, type en } from '@rivr/i18n';
import type { BottomNavItem } from '../BottomNav/BottomNav.tsx';
import type { SideNavItem, SideNavSection } from '../SideNav/SideNav.tsx';

type RailItem = keyof typeof en.console.rail.items;

// The rail's labels are the console's own copy, which the console registers at start; the stories and tests do the same.
registerMessages({ console: consoleApp });

/** The console rail, grouped by the job (#602): Overview, Tonight, Cage, Players, Marketing, Money, Team and Reports. */
export function consoleSections(): SideNavSection[] {
  const item = (id: RailItem): SideNavItem => ({ id, label: t(`console.rail.items.${id}`), href: `#${id}` });
  return [
    // Overview is a single link, so it has no heading of its own.
    { id: 'overview', items: [item('overview')] },
    { id: 'tonight', label: t('console.rail.groups.tonight'), items: [item('liveFloor'), item('waitlist'), item('checkIn'), item('tournaments'), item('jackpots')] },
    { id: 'cage', label: t('console.rail.groups.cage'), items: [item('cage'), item('endOfDay')] },
    { id: 'players', label: t('console.rail.groups.players'), items: [item('members'), item('kycReview'), item('hostQueue')] },
    { id: 'marketing', label: t('console.rail.groups.marketing'), items: [item('promotions'), item('rewards'), item('academy')] },
    { id: 'money', label: t('console.rail.groups.money'), items: [item('markers'), item('treasury')] },
    { id: 'team', label: t('console.rail.groups.team'), items: [item('staff'), item('sops')] },
    { id: 'reports', label: t('console.rail.groups.reports'), items: [item('reports'), item('hands')] },
  ];
}

const ENABLED = { state: 'enabled' } as const;

/** The five player tabs, every one enabled. */
export const PLAYER_TABS: BottomNavItem[] = [
  { tab: 'home', href: '#home', access: ENABLED },
  { tab: 'sessions', href: '#sessions', access: ENABLED },
  { tab: 'balance', href: '#balance', access: ENABLED },
  { tab: 'rewards', href: '#rewards', access: ENABLED },
  { tab: 'learn', href: '#learn', access: ENABLED },
];
