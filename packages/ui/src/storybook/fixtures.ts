/**
 * Sample navigation for stories: the console rail and the player tabs as the design prompt
 * lists them. Apps build their own from their routes and the signed-in role.
 */
import { t, type en } from '@rivr/i18n';
import type { BottomNavItem } from '../BottomNav/BottomNav.tsx';
import type { SideNavItem, SideNavSection } from '../SideNav/SideNav.tsx';

type RailItem = keyof typeof en.console.rail.items;

/** The console rail: Floor, Money, Players, Growth, Team and Reports. */
export function consoleSections(): SideNavSection[] {
  const item = (id: RailItem): SideNavItem => ({ id, label: t(`console.rail.items.${id}`), href: `#${id}` });
  return [
    { id: 'floor', label: t('console.rail.groups.floor'), items: [item('liveFloor'), item('waitlist'), item('checkIn'), item('tournaments')] },
    { id: 'money', label: t('console.rail.groups.money'), items: [item('cage'), item('markers'), item('treasury'), item('endOfDay')] },
    { id: 'players', label: t('console.rail.groups.players'), items: [item('members'), item('kycReview'), item('hostQueue')] },
    { id: 'growth', label: t('console.rail.groups.growth'), items: [item('promotions'), item('jackpots'), item('rewards'), item('academy')] },
    { id: 'team', label: t('console.rail.groups.team'), items: [item('staff'), item('dealers'), item('sops')] },
    // Reports is a single link, so it has no heading of its own.
    { id: 'reports', items: [item('reports')] },
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
