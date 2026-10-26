import { useRakeTonight } from '@rivr/db/reports';
import { t } from '@rivr/i18n';
import { Grid, Heading, Stack, Text } from '@rivr/ui';
import { RakeTable } from './RakeTable.tsx';

/** Tonight's rake (#99): by table, dealer and game, from the hands logged since 06:00, refreshed each minute. */
export function RakeTonight({ venueId }: { venueId: string }) {
  const tonight = useRakeTonight(venueId);
  const state = { isError: tonight.isError, onRetry: () => void tonight.refetch(), emptyText: t('console.reports.noHandsTonight') };
  return (
    <Stack gap={4}>
      <Heading level={2}>{t('console.reports.tonight')}</Heading>
      <Text variant="small" tone="muted">{t('console.reports.tonightHint')}</Text>
      <Grid columns={3} gap={6}>
        <RakeTable {...state} label={t('console.reports.tonightByTable')} nameHeader={t('console.reports.table')} rows={tonight.data?.byTable} />
        <RakeTable {...state} label={t('console.reports.tonightByDealer')} nameHeader={t('console.reports.dealer')} rows={tonight.data?.byDealer} />
        <RakeTable {...state} label={t('console.reports.tonightByVariant')} nameHeader={t('console.reports.variant')} rows={tonight.data?.byVariant} />
      </Grid>
    </Stack>
  );
}
