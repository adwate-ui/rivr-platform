import { useFeature, useMyUpcomingTournaments, useRegisterTournamentInterest, type FloorTable, type UpcomingTournament } from '@rivr/db';
import { formatDayTime, t } from '@rivr/i18n';
import { Button, FeatureGate, Heading, Inline, Stack, TableListRow, Text, useToast } from '@rivr/ui';

/** The wait at a table's right: gold "No wait", how many wait, or closed. */
function waitOf(table: FloorTable): string {
  if (!table.isOpen) return t('player.live.closed');
  return table.waiting === 0 ? t('player.live.noWait') : t('player.live.waiting', { count: table.waiting });
}

/** Under the wait: how many seats are open, full, or that a closed table opens later. */
function seatsLineOf(table: FloorTable): string {
  if (!table.isOpen) return t('player.live.opensLater');
  const open = table.openSeats ?? 0;
  return open === 0 ? t('player.live.full') : t('player.live.seatsOpen', { count: open });
}

/** The pill's word: Notify me, Notifying you once asked, or Registered once the floor has registered them (#636). */
function standingLabel(standing: UpcomingTournament['standing']): string {
  if (standing === 'registered') return t('player.tonight.standing.registered');
  return t(standing === 'interested' ? 'player.live.notifying' : 'player.live.notifyMe');
}

/** One upcoming tournament with Notify me, Notifying you once the member has asked, or Registered (#636). */
function TournamentRow({ tournament }: { tournament: UpcomingTournament }) {
  const register = useRegisterTournamentInterest();
  const toast = useToast();
  const isNotifying = tournament.standing !== 'none';
  const ask = async () => {
    const asked = await register.mutateAsync(tournament.tournamentId);
    if (!asked.ok) toast(t(`player.tonight.interestFailures.${asked.error}`));
  };
  return (
    <Inline gap={3} justify="between" align="center">
      <Stack gap={1}>
        <Text weight="medium">{tournament.name}</Text>
        <Text variant="small" tone="muted">{formatDayTime(new Date(tournament.startsAt))}</Text>
      </Stack>
      <Button variant="outline" shape="pill" isPressed={isNotifying} isLoading={register.isPending}
        aria-label={t('player.tonight.registerInterestName', { name: tournament.name })}
        onClick={() => { if (!isNotifying) void ask(); }}>
        {standingLabel(tournament.standing)}
      </Button>
    </Inline>
  );
}

/** The club's upcoming tournaments under the tables (feature tournaments.register), each a ruled row. */
function Tournaments() {
  const access = useFeature('tournaments.register');
  const upcoming = useMyUpcomingTournaments().data ?? [];
  if (upcoming.length === 0) return null;
  return (
    <FeatureGate access={access}>
      <Stack gap={3}>
        <Heading level={3} variant="section">{t('player.live.tournaments')}</Heading>
        <Stack gap={3} divided>{upcoming.map((tournament) => <TournamentRow key={tournament.tournamentId} tournament={tournament} />)}</Stack>
      </Stack>
    </FeatureGate>
  );
}

/**
 * Tonight's tables (decision 0320) with the live floor: a row a table with a dot a seat, the wait, and how many seats are
 * open; a closed table dimmed. `onOpen` opens a table's join sheet; without it the rows only show. Then the tournaments.
 */
export function TablesList({ tables, onOpen }: { tables: readonly FloorTable[]; onOpen?: ((table: FloorTable) => void) | undefined }) {
  const liveView = useFeature('floor.live_view');
  return (
    <Stack gap={8}>
      <FeatureGate access={liveView}>
        <Stack gap={0}>
          {tables.map((table) => (
            <TableListRow key={table.id} name={t('player.live.tableName', { name: table.name, game: table.tableTypeName })}
              seatCount={table.seats} openSeats={table.isOpen ? table.openSeats ?? 0 : 0} wait={waitOf(table)}
              isNoWait={table.waiting === 0} seatsLine={seatsLineOf(table)} isClosed={!table.isOpen}
              onOpen={onOpen ? () => onOpen(table) : undefined} />
          ))}
        </Stack>
      </FeatureGate>
      <Tournaments />
    </Stack>
  );
}

/** "4 running", or with tournaments coming "4 running · 2 tournaments": the peek bar's and the panel's aside. */
export function runningLine(tables: readonly FloorTable[], tournaments: number): string {
  const running = tables.filter((table) => table.isOpen).length;
  return tournaments === 0 ? t('player.live.running', { count: running })
    : t('player.live.runningWithTournaments', { tables: running, tournaments });
}
