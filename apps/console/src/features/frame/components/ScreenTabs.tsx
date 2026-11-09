import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, StatusMessage, Tabs } from '@rivr/ui';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import { Suspense, type ComponentType } from 'react';
import { screenWithTabs, tabsFor, type ScreenTab } from './rail.ts';
import { MOVED_NOTICES } from './tabSearch.ts';

export interface ScreenTabsProps {
  /** The rail entry of the screen that holds the tabs: `door`, `rewards`, `content`, `settings`, `requests`, `waitlist`. */
  screen: string;
  /** Each tab's own screen, by the tab's id. */
  panes: Readonly<Record<string, ComponentType>>;
}

/**
 * A screen that holds others by tab (console v3): its title, then its one row of tabs as pills, only those the staff
 * member's role opens, the one named in the address (`?tab=`) or the first, and below them that tab's screen, as a part of
 * this one (its own title heard, not shown again; its actions in the title row). An old address that moved here says so
 * in a line (#811). The frame has already refused a tab outside the role.
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
  const notice = MOVED_NOTICES.find((one) => one === search.get('notice'));
  const line = notice === undefined ? null : <StatusMessage>{t(`console.shell.moved.${notice}`)}</StatusMessage>;
  const pane = current === undefined ? null : <TabPane tab={current} Pane={panes[current.id]} />;
  if (current === undefined) return <Stack gap={6}>{line}{pane}</Stack>;
  // A role with one of the tabs has that tab's screen alone, under the rail's name, as they reached it (F-094).
  if (tabs.length < 2) return <Screen title={t(entry.label)} tabs={null}>{line}{pane}</Screen>;
  const tabBar = (
    <Tabs look="pill" label={t(entry.label)} current={current.id} onNavigate={(href) => void navigate({ href })}
      tabs={tabs.map((tab) => ({ id: tab.id, label: t(tab.label), href: `${entry.href}?tab=${tab.id}` }))} />
  );
  // The screen's title, then its tabs, then the tab's own screen, whose title the tab already says (as in the prototype).
  return <Screen title={t(entry.label)} tabs={tabBar}>{line}{pane}</Screen>;
}

/** A tab's own screen; one loaded when first opened, such as Learn content, shows its screen loading meanwhile. */
function TabPane({ tab, Pane }: { tab: ScreenTab; Pane: ComponentType | undefined }) {
  if (Pane === undefined) return null;
  return <Suspense fallback={<Screen title={t(tab.label)} status="loading" />}><Pane /></Suspense>;
}
