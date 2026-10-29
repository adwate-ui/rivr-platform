import { useFeature, useMyTonight, useMyTournament, type MyTournament, type NextTournament } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { FeatureGate, Stack, Text } from '@rivr/ui';
import { LiveTournament } from './LiveTournament.tsx';
import { MyStandingLine, TournamentBuy } from './TournamentBuy.tsx';

type Upcoming = Pick<NextTournament, 'name' | 'startsAt'>;

/** The next tournament at the member's venue: its name and when it starts. No buy-in or guarantee (#627). */
function NextTournamentLines({ tournament }: { tournament: Upcoming }) {
  return (
    <Stack gap={1}>
      <Text variant="small" tone="muted">{t('player.tonight.nextTournament')}</Text>
      <Text weight="medium">{tournament.name}</Text>
      <Text variant="small" tone="muted">{formatDayTime(new Date(tournament.startsAt))}</Text>
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
 * The member's tournament, with tournament registration (#87, decision 0116), above tonight's tables. While a
 * tournament runs (#119) its clock ticks, as in the prototype; the member registers, re-enters or rebuys from it
 * (#118). The bad-beat jackpot is gone from Home (#627): the app shows no rupee. Nothing shows while it loads or if
 * it cannot be read: Home's tables matter more, and the next read brings it. A locked tournament registration says so.
 */
export function TonightHighlights() {
  const tournaments = useFeature('tournaments.register');
  const mine = useMyTournament().data ?? null;
  const tonight = useMyTonight().data;
  if (!tonight) return null;
  const upcoming = tonight.nextTournament;
  const card = mine === null ? upcoming && <NextTournamentLines tournament={upcoming} /> : <MyTournamentCard tournament={mine} />;
  return <FeatureGate access={tournaments}>{card}</FeatureGate>;
}
