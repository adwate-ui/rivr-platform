import { useStaffVenue } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { MonthlyMis } from './MonthlyMis.tsx';
import { UnclaimedBalances } from './UnclaimedBalances.tsx';
import { GrowthFunnel } from './GrowthFunnel.tsx';
import { RakeTonight } from './RakeTonight.tsx';

/**
 * Reports (#99; scope-v1 modules 4 and 16): tonight's rake by table, dealer and game from hand records,
 * the monthly investor MIS, unclaimed balances and the growth funnel (#166). For staff who read reports; the practice venue has none.
 */
export function ReportsScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  const title = t('console.reports.title');
  const { permissions, venueId, isPractice } = staff.venue;
  if (!permissions.includes('reports.read')) return <Screen title={title} status="error" errorText={t('console.reports.notAllowed')} />;
  if (isPractice) return <Screen title={title} status="error" errorText={t('console.reports.practice')} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <RakeTonight venueId={venueId} />
        <MonthlyMis venueId={venueId} />
        <UnclaimedBalances venueId={venueId} />
        <GrowthFunnel venueId={venueId} />
      </Stack>
    </Screen>
  );
}
