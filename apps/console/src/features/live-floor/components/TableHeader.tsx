import type { FloorTable, TableNight } from '@rivr/db';
import { formatStakes, t } from '@rivr/i18n';
import { Grid, Heading, Number as Count, Stack, Text } from '@rivr/ui';

/**
 * The chosen table's name and stakes, its night so far (hands, hands in the last hour) and its dealer (#81). No buy-in in
 * rupees and no rake: no console shows money or rake (owner, 29 Oct, #626).
 */
export function TableHeader({ table, night }: { table: FloorTable; night: TableNight | undefined }) {
  return (
    <Stack gap={4}>
      <Stack gap={1}><Heading level={2}>{table.name}</Heading><Text tone="muted">{formatStakes(table.smallBlind, table.bigBlind)}</Text></Stack>
      <Grid columns={2} gap={4}>
        <Stack gap={1}><Text variant="small" tone="muted">{t('console.liveFloor.hands')}</Text><Count value={night?.hands ?? 0} size="lead" /></Stack>
        <Stack gap={1}><Text variant="small" tone="muted">{t('console.liveFloor.perHour')}</Text><Count value={night?.handsLastHour ?? 0} size="lead" /></Stack>
      </Grid>
      <Text variant="small" tone="muted">{night?.dealerName ? t('console.liveFloor.dealer', { name: night.dealerName }) : t('console.liveFloor.noDealer')}</Text>
    </Stack>
  );
}
