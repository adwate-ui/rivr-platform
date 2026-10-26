import { useFeature, useMyTonight, useMyTournament, type MyTournament, type NextTournament } from '@rivr/db';
import { formatDayTime, formatMoney, t } from '@rivr/i18n';
import { FeatureGate, Grid, Money, Stack, Text } from '@rivr/ui';
import { LiveTournament } from './LiveTournament.tsx';
import { MyStandingLine, TournamentBuy } from './TournamentBuy.tsx';

type Upcoming = Pick<NextTournament, 'name' | 'startsAt' | 'buyIn' | 'guarantee'>;

/** The next tournament at the member's venue: its name, when it starts, its buy-in and any guarantee. */
function NextTournamentLines({ tournament }: { tournament: Upcoming }) {
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

/** The member's tournament: running with its clock, or the next; their own standing; and what they may buy. */
function MyTournamentCard({ tournament }: { tournament: MyTournament }) {
  return (
    <Stack gap={2}>
      {tournament.isRunning ? <LiveTournament tournament={tournament} /> : <NextTournamentLines tournament={tournament} />}
      <MyStandingLine tournament={tournament} />
      <TournamentBuy tournament={tournament} />
    </Stack>
  );
}

/**
 * The bad-beat jackpot, with the live floor, and the member's tournament, with tournament registration
 * (#87, decision 0116), side by side above tonight's tables. While a tournament runs (#119) it takes the
 * full width under the jackpot, its clock ticking, as in the prototype; the member registers, re-enters or
 * rebuys from it (#118). Nothing shows while they load or if they cannot be read: Home's tables matter
 * more, and the next read brings them. A locked live floor says so once, around the tables, so the
 * jackpot simply stays away; a locked tournament registration says so here.
 */
export function TonightHighlights() {
  const liveView = useFeature('floor.live_view');
  const tournaments = useFeature('tournaments.register');
  const mine = useMyTournament().data ?? null;
  const tonight = useMyTonight().data;
  if (!tonight) return null;
  const jackpot = liveView.state === 'enabled' ? tonight.jackpot : null;
  const upcoming = tonight.nextTournament;
  const card = mine === null ? upcoming && <NextTournamentLines tournament={upcoming} /> : <MyTournamentCard tournament={mine} />;
  return (
    <Grid columns={mine?.isRunning === true ? 1 : 2} gap={4}>
      {jackpot === null ? null : (
        <Stack gap={1}>
          <Text variant="small" tone="muted">{t('player.tonight.jackpot')}</Text>
          <Money paise={jackpot} />
        </Stack>
      )}
      <FeatureGate access={tournaments}>{card}</FeatureGate>
    </Grid>
  );
}
