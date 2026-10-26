import { useFeature, useMyTonight, type NextTournament } from '@rivr/db';
import { formatDayTime, formatMoney, t } from '@rivr/i18n';
import { FeatureGate, Grid, Money, Stack, Text } from '@rivr/ui';
import { LiveTournament, useIsTournamentLive } from './LiveTournament.tsx';

/** The next tournament at the member's venue: its name, when it starts, its buy-in and any guarantee. */
function NextTournamentLines({ tournament }: { tournament: NextTournament }) {
  return (
    <Stack gap={1}>
      <Text variant="small" tone="muted">{t('player.tonight.nextTournament')}</Text>
      <Text weight="medium">{tournament.name}</Text>
      <Text variant="small" tone="muted">
        {t('player.tonight.tournamentWhen', { when: formatDayTime(new Date(tournament.startsAt)), buyIn: formatMoney(tournament.buyIn) })}
      </Text>
      {tournament.guarantee === null ? null : <Text variant="small" tone="muted">{t('player.tonight.guaranteed', { amount: formatMoney(tournament.guarantee) })}</Text>}
    </Stack>
  );
}

/**
 * The bad-beat jackpot, with the live floor, and the next tournament at the member's venue, with
 * tournament registration (#87, decision 0116), side by side above tonight's tables. While a tournament
 * runs (#119), it shows instead of the next one, full width under the jackpot, its clock ticking, as in
 * the prototype; the database shows it only to members with tournament registration. Nothing shows while
 * they load or if they cannot be read: Home's tables matter more, and the next read brings them. A locked
 * live floor says so once, around the tables, so the jackpot simply stays away; a locked tournament
 * registration says so here.
 */
export function TonightHighlights() {
  const liveView = useFeature('floor.live_view');
  const tournaments = useFeature('tournaments.register');
  const isLive = useIsTournamentLive();
  const tonight = useMyTonight().data;
  if (!tonight) return null;
  const jackpot = liveView.state === 'enabled' ? tonight.jackpot : null;
  const tournament = isLive ? <LiveTournament /> : tonight.nextTournament && <NextTournamentLines tournament={tonight.nextTournament} />;
  return (
    <Grid columns={isLive ? 1 : 2} gap={4}>
      {jackpot === null ? null : (
        <Stack gap={1}>
          <Text variant="small" tone="muted">{t('player.tonight.jackpot')}</Text>
          <Money paise={jackpot} />
        </Stack>
      )}
      <FeatureGate access={tournaments}>{tournament}</FeatureGate>
    </Grid>
  );
}
