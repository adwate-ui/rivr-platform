import type { Permission } from '@rivr/contracts';
import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, Tabs } from '@rivr/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { WaitlistLists } from './WaitlistLists.tsx';

type WaitlistTab = 'lists' | 'interest';

/** The tabs the role gives: Lists to the floor (waitlist.manage), Tournament interest to staff who manage tournaments. */
function tabsFor(permissions: readonly Permission[]): WaitlistTab[] {
  const tabs: WaitlistTab[] = [];
  if (permissions.includes('waitlist.manage')) tabs.push('lists');
  if (permissions.includes('tournaments.manage')) tabs.push('interest');
  return tabs;
}

/**
 * Waitlist (console v3): Lists, a card for each table's own list (decision 0433), and Tournament interest, given by the
 * route as `interest` (another feature's), each a tab in the address (`?tab=lists`, `?tab=interest`), so a refresh, Back
 * or a shared link opens it.
 */
export function WaitlistScreen({ interest }: { interest: ReactNode }) {
  const staff = useStaffVenue();
  const navigate = useNavigate();
  const { tab } = useSearch({ from: '/frame/waitlist' });
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const { venueId, permissions } = staff.venue;
  const tabs = tabsFor(permissions);
  const title = t('console.waitlist.title');
  const current = tabs.find((one) => one === tab) ?? tabs[0];
  if (current === undefined) return <Screen title={title} status="error" errorText={t('console.waitlist.notAllowed')} />;
  return (
    <Screen title={title}>
      <Stack gap={6}>
        {tabs.length > 1 ? (
          <Tabs look="pill" label={t('console.waitlist.tabs.label')} current={current} onNavigate={(href) => void navigate({ href })}
            tabs={tabs.map((id) => ({ id, label: t(`console.waitlist.tabs.${id}`), href: `/waitlist?tab=${id}` }))} />
        ) : null}
        {current === 'interest' ? interest : <WaitlistLists venueId={venueId} canOpen={permissions.includes('floor.manage')} />}
      </Stack>
    </Screen>
  );
}
