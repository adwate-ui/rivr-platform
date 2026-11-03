import { useStaffVenue, useTablesSetup } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Screen, Stack } from '@rivr/ui';
import { StakesBlock } from './StakesBlock.tsx';
import { TablesBlock } from './TablesBlock.tsx';

/**
 * Tables setup (#642; owner's feedback doc of 29 Oct, super admin module 1), for tables.manage: the stakes the club runs,
 * each a game and its blinds, and its tables, each with a stake and its seats, deactivated, reactivated or deleted
 * (decision 0432). The floor opens and closes them.
 */
export function TablesSetupScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('tables.manage')) {
    return <Screen title={t('console.tablesSetup.title')} status="error" errorText={t('console.tablesSetup.notAllowed')} />;
  }
  return <Setup venueId={staff.venue.venueId} />;
}

function Setup({ venueId }: { venueId: string }) {
  const setup = useTablesSetup(venueId);
  const title = t('console.tablesSetup.title');
  if (setup.isPending) return <Screen title={title} status="loading" />;
  if (setup.data === undefined) return <Screen title={title} status="error" onRetry={() => void setup.refetch()} />;
  return (
    <Screen title={title}>
      <Stack gap={8}>
        <StakesBlock venueId={venueId} stakes={setup.data.stakes} />
        <TablesBlock venueId={venueId} stakes={setup.data.stakes} tables={setup.data.tables} />
      </Stack>
    </Screen>
  );
}
