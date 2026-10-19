import type { FloorTable, TableNight } from '@rivr/db';
import { formatMoney, formatNumber, formatStakes, t } from '@rivr/i18n';
import { Grid, Heading, Money, Number as Count, Stack, Text } from '@rivr/ui';

/** The table's line under its name, as in the prototype: stakes, buy-in and the rake rule in force. */
function lineOf(table: FloorTable, night: TableNight | undefined): string {
  const stakes = formatStakes(table.smallBlind, table.bigBlind);
  if (night?.rakeBasisPoints === null || night?.rakeBasisPoints === undefined || night.rakeCap === null) {
    return t('console.liveFloor.tableLineNoRake', { stakes, buyIn: formatMoney(table.buyIn) });
  }
  return t('console.liveFloor.tableLine', { stakes, buyIn: formatMoney(table.buyIn), rate: formatNumber(night.rakeBasisPoints / 100), cap: formatMoney(night.rakeCap) });
}

/** The chosen table's name and rules, its night so far (rake tonight, hands, hands in the last hour) and its dealer (#81). */
export function TableHeader({ table, night }: { table: FloorTable; night: TableNight | undefined }) {
  return (
    <Stack gap={4}>
      <Stack gap={1}><Heading level={2}>{table.name}</Heading><Text tone="muted">{lineOf(table, night)}</Text></Stack>
      <Grid columns={3} gap={4}>
        {night?.rake === null || night === undefined ? null : (
          <Stack gap={1}><Text variant="small" tone="muted">{t('console.liveFloor.rakeTonight')}</Text><Money paise={night.rake} size="lead" /></Stack>
        )}
        <Stack gap={1}><Text variant="small" tone="muted">{t('console.liveFloor.hands')}</Text><Count value={night?.hands ?? 0} size="lead" /></Stack>
        <Stack gap={1}><Text variant="small" tone="muted">{t('console.liveFloor.perHour')}</Text><Count value={night?.handsLastHour ?? 0} size="lead" /></Stack>
      </Grid>
      <Text variant="small" tone="muted">{night?.dealerName ? t('console.liveFloor.dealer', { name: night.dealerName }) : t('console.liveFloor.noDealer')}</Text>
    </Stack>
  );
}
