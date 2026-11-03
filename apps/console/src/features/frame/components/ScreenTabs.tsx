import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, StatusMessage, Tabs } from '@rivr/ui';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Suspense, type ComponentType } from 'react';
import { screenWithTabs, tabsFor } from './rail.ts';
import { MOVED_NOTICES } from './tabSearch.ts';

export interface ScreenTabsProps {
  /** The rail entry of the screen that holds the tabs: `door`, `rewards`, `content`, `settings`, `requests`, `waitlist`. */
  screen: string;
  /** Each tab's own screen, by the tab's id. */
  panes: Readonly<Record<string, ComponentType>>;
}

/**
 * A screen that holds others by tab (console v3): its title, then its tabs as pills, only those the staff member's role
 * opens, the one named in the address (`?tab=`) or the first, and below them that tab's screen, as a part of this one (its
 * own title heard, not shown again). An old address that moved here says so in a line (#811). The frame has already
 * refused a tab outside the role.
 */
export function ScreenTabs({ screen, panes }: ScreenTabsProps) {
  const staff = useStaffVenue();
  const navigate = useNavigate();
  const search = new URLSearchParams(useRouterState({ select: (state) => state.location.searchStr }));
  const entry = screenWithTabs(screen);
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready' || entry === undefined) return null;
  const tabs = tabsFor(entry, staff.venue.permissions);
  const current = tabs.find((tab) => tab.id === search.get('tab')) ?? tabs[0];
  const Pane = current === undefined ? undefined : panes[current.id];
  const notice = MOVED_NOTICES.find((one) => one === search.get('notice'));
  const tabBar = tabs.length > 1 && current !== undefined ? (
    <Tabs look="pill" label={t(entry.label)} current={current.id} onNavigate={(href) => void navigate({ href })}
      tabs={tabs.map((tab) => ({ id: tab.id, label: t(tab.label), href: `${entry.href}?tab=${tab.id}` }))} />
  ) : undefined;
  // The screen's title, then its tabs, then the tab's own screen, whose title the tab already says (as in the prototype).
  return (
    <Screen title={t(entry.label)} tabs={tabBar}>
      {notice === undefined ? null : <StatusMessage>{t(`console.shell.moved.${notice}`)}</StatusMessage>}
      {/* A tab loaded when first opened, such as Learn content, shows its screen loading meanwhile. */}
      {Pane === undefined || current === undefined ? null : (
        <Suspense fallback={<Screen title={t(current.label)} status="loading" />}><Pane /></Suspense>
      )}
    </Screen>
  );
}
