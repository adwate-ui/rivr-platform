/**
 * Sample navigation for stories: the console rail and the player tabs as the design prompt
 * lists them. Apps build their own from their routes and the signed-in role.
 */
import type { BottomNavItem } from '../BottomNav/BottomNav.tsx';
import type { SideNavItem, SideNavSection } from '../SideNav/SideNav.tsx';

/**
 * The console v3 rail as its prototype has it (decision 0465): Tonight, Players, Marketing and the folded Admin, with the
 * super admin's danger screens. Counts in gold ask for action; the rest are for information.
 */
export function consoleSections(): SideNavSection[] {
  const item = (id: string, label: string, icon: SideNavItem['icon'], extra: Partial<SideNavItem> = {}): SideNavItem =>
    ({ id, label, icon, href: `#${id}`, ...extra });
  return [
    { id: 'tonight', label: 'Tonight', items: [
      item('floor', 'Live floor', 'floor', { count: 9, isActionable: true }), item('waitlist', 'Waitlist', 'waitlist', { count: 3, isActionable: true }),
      item('door', 'Door', 'door'), item('fnb', 'Food and drink', 'food', { count: 2, isActionable: true }),
    ] },
    { id: 'players', label: 'Players', items: [
      item('members', 'Members', 'profile'), item('kyc', 'KYC review', 'kyc', { count: 2 }), item('host', 'Host queue', 'phone', { count: 1 }),
      item('feedback', 'Feedback', 'feedback', { count: 4 }),
    ] },
    { id: 'marketing', label: 'Marketing', items: [
      item('promotions', 'Promotions', 'promotions'), item('rewards', 'Rewards', 'rewards'), item('social', 'Social', 'social', { count: 2 }),
      item('content', 'Content', 'content'),
    ] },
    { id: 'admin', label: 'Admin', isCollapsible: true, items: [
      item('staff', 'Staff', 'staff'), item('tables', 'Tables', 'tables'), item('settings', 'Settings', 'settings'),
      item('kill', 'Kill switch', 'alert', { tone: 'danger' }), item('reset', 'Practice reset', 'reset', { tone: 'danger' }),
      item('purge', 'Purge', 'purge', { tone: 'danger' }),
    ] },
  ];
}

/** The console's phone tabs (console v3): Floor, Requests, Waitlist and Door; the shell adds More. */
export function consoleTabs(): SideNavItem[] {
  return [
    { id: 'floor', label: 'Floor', icon: 'floor', href: '#floor' },
    { id: 'requests', label: 'Requests', icon: 'requests', href: '#requests', count: 12, isActionable: true },
    { id: 'waitlist', label: 'Waitlist', icon: 'waitlist', href: '#waitlist', count: 3, isActionable: true },
    { id: 'door', label: 'Door', icon: 'door', href: '#door' },
  ];
}

const ENABLED = { state: 'enabled' } as const;

/** The five player tabs, every one enabled. */
export const PLAYER_TABS: BottomNavItem[] = [
  { tab: 'home', href: '#home', access: ENABLED },
  { tab: 'sessions', href: '#sessions', access: ENABLED },
  { tab: 'card', href: '#card', access: ENABLED },
  { tab: 'rewards', href: '#rewards', access: ENABLED },
];
