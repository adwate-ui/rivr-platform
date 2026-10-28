import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack, Tabs } from '@rivr/ui';
import { useNavigate, useSearch } from '@tanstack/react-router';
import { MonthlyMis } from './MonthlyMis.tsx';
import { UnclaimedBalances } from './UnclaimedBalances.tsx';
import { ChannelFunnel } from './ChannelFunnel.tsx';
import { GrowthFunnel } from './GrowthFunnel.tsx';
import { RakeTonight } from './RakeTonight.tsx';

const TABS = ['tonight', 'mis', 'unclaimed', 'growth'] as const;
type ReportTab = (typeof TABS)[number];

/** The report a tab shows. */
function TabContent({ tab, venueId }: { tab: ReportTab; venueId: string }) {
  if (tab === 'mis') return <MonthlyMis venueId={venueId} />;
  if (tab === 'unclaimed') return <UnclaimedBalances venueId={venueId} />;
  if (tab === 'growth') return <Stack gap={8}><GrowthFunnel venueId={venueId} /><ChannelFunnel venueId={venueId} /></Stack>;
  return <RakeTonight venueId={venueId} />;
}

/**
 * Reports (#99; scope-v1 modules 4 and 16), one at a time by tab (#605): tonight's rake by table, dealer and game from hand records,
 * the monthly investor MIS, unclaimed balances, the growth funnel (#166) and each channel's followers beside it (#164). For staff who
 * read reports; the practice venue has none.
 */
export function ReportsScreen() {
  const staff = useStaffVenue();
  const navigate = useNavigate();
  // The report open is in the address (`?tab=mis`), so a refresh, Back or a shared link opens it.
  const { tab } = useSearch({ from: '/frame/reports' });
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.reports.title');
  const { permissions, venueId, isPractice } = staff.venue;
  if (!permissions.includes('reports.read')) return <Screen title={title} status="error" errorText={t('console.reports.notAllowed')} />;
  if (isPractice) return <Screen title={title} status="error" errorText={t('console.reports.practice')} />;
  const current = TABS.find((one) => one === tab) ?? 'tonight';
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <Tabs label={t('console.reports.tabsLabel')} current={current} onNavigate={(href) => void navigate({ href })}
          tabs={TABS.map((id) => ({ id, label: t(`console.reports.tabs.${id}`), href: `/reports?tab=${id}` }))} />
        <TabContent tab={current} venueId={venueId} />
      </Stack>
    </Screen>
  );
}
