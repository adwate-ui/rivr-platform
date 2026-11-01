import type { FloorTable, SeatedPlayer, TableNight } from '@rivr/db';
import { formatStakes, t } from '@rivr/i18n';
import { Grid, Heading, Number as Count, Stack, Text } from '@rivr/ui';

/**
 * The chosen table's name and stakes, who there still owes call time and who asks for a top-up, and its dealer (#81).
 * Hands are no longer counted at the table (#630), so no figure of them shows (UI polish audit A-11). No buy-in in
 * rupees and no rake: no console shows money or rake (owner, 29 Oct, #626). A role without members.read gets no night
 * from floor_tonight, so it sees the name and stakes alone rather than noughts (F2-25).
 */
export function TableHeader({ table, players, night, canSeeNight }: {
  table: FloorTable; players: readonly SeatedPlayer[]; night: TableNight | undefined; canSeeNight: boolean;
}) {
  const name = <Stack gap={1}><Heading level={2}>{table.name}</Heading><Text tone="muted">{formatStakes(table.smallBlind, table.bigBlind)}</Text></Stack>;
  if (!canSeeNight) return name;
  return (
    <Stack gap={4}>
      {name}
      <Grid columns={2} gap={4}>
        <Stack gap={1}>
          <Text variant="small" tone="muted">{t('console.liveFloor.callTimeRunning')}</Text>
          <Count value={players.filter((player) => (player.callTimeLeft ?? 0) > 0).length} size="lead" />
        </Stack>
        <Stack gap={1}>
          <Text variant="small" tone="muted">{t('console.liveFloor.topUpsWaiting')}</Text>
          <Count value={players.filter((player) => player.topUp === 'requested').length} size="lead" />
        </Stack>
      </Grid>
      <Text variant="small" tone="muted">{night?.dealerName ? t('console.liveFloor.dealer', { name: night.dealerName }) : t('console.liveFloor.noDealer')}</Text>
    </Stack>
  );
}
