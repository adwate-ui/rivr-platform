import { useGamesHistory, useStaffVenue, type GamesDay } from '@rivr/db';
import { formatDate, formatDuration, formatIsoDay, formatStakes, t } from '@rivr/i18n';
import { DataTable, ErrorMessage, Inline, Input, Screen, Stack, type DataTableColumn } from '@rivr/ui';
import { useState } from 'react';

const DAY_MS = 86_400_000;
// A club day runs to 06:00 IST, so until then it is still the day before.
const NIGHT_ENDS_MS = 6 * 3_600_000;

/** The club day a moment falls in, as `2026-11-01`. */
const clubDayAt = (ms: number) => formatIsoDay(new Date(ms - NIGHT_ENDS_MS));

// Noon IST, so the day reads as itself whatever the time zone.
const dayText = (day: string) => formatDate(new Date(`${day}T12:00:00+05:30`));

const stakeText = (row: GamesDay) => t('console.gamesHistory.stakeLine', { game: t(`console.gamesHistory.games.${row.game}`), blinds: formatStakes(row.smallBlind, row.bigBlind) });

const COLUMNS: readonly DataTableColumn<GamesDay>[] = [
  { key: 'day', header: t('console.gamesHistory.day'), cell: (row) => dayText(row.clubDay), sortValue: (row) => row.clubDay, priority: 'primary' },
  { key: 'table', header: t('console.gamesHistory.table'), cell: (row) => row.tableName, sortValue: (row) => row.tableName },
  { key: 'stake', header: t('console.gamesHistory.stake'), cell: stakeText, sortValue: (row) => Number(row.bigBlind) },
  { key: 'runs', header: t('console.gamesHistory.runs'), cell: (row) => String(row.runs), sortValue: (row) => row.runs, align: 'end' },
  { key: 'hours', header: t('console.gamesHistory.hours'), cell: (row) => formatDuration(row.seconds), sortValue: (row) => row.seconds, align: 'end' },
];

/**
 * Games history (#643; owner's feedback doc of 29 Oct, super admin module 7), for tables.manage: the tables run on each
 * club day of a range, the last seven days at first, how many times each opened and how long it ran; sorted and filtered.
 */
export function GamesHistoryScreen() {
  const staff = useStaffVenue();
  // The frame shows a screen only once the staff member's venue is known.
  if (staff.status !== 'ready') return null;
  if (!staff.venue.permissions.includes('tables.manage')) {
    return <Screen title={t('console.gamesHistory.title')} status="error" errorText={t('console.gamesHistory.notAllowed')} />;
  }
  return <History venueId={staff.venue.venueId} />;
}

function History({ venueId }: { venueId: string }) {
  const [typed, setTyped] = useState(() => ({ from: clubDayAt(Date.now() - 6 * DAY_MS), to: clubDayAt(Date.now()) }));
  const [range, setRange] = useState(typed);
  const isRange = typed.from !== '' && typed.to !== '' && typed.from <= typed.to;
  const history = useGamesHistory(venueId, range.from, range.to);
  const choose = (next: typeof typed) => {
    setTyped(next);
    if (next.from !== '' && next.to !== '' && next.from <= next.to) setRange(next);
  };
  const table = { label: t('console.gamesHistory.label'), columns: COLUMNS, rowKey: (row: GamesDay) => `${row.clubDay}:${row.tableId}` };
  return (
    <Screen title={t('console.gamesHistory.title')}>
      <Stack gap={6}>
        <Inline gap={4} wrap>
          <Input type="date" label={t('console.gamesHistory.from')} value={typed.from} onChange={(event) => choose({ ...typed, from: event.target.value })} />
          <Input type="date" label={t('console.gamesHistory.to')} value={typed.to} onChange={(event) => choose({ ...typed, to: event.target.value })} />
        </Inline>
        {isRange ? null : <ErrorMessage>{t('console.gamesHistory.rangeInvalid')}</ErrorMessage>}
        {history.data === undefined ? (
          history.isError ? <DataTable {...table} status="error" onRetry={() => void history.refetch()} /> : <DataTable {...table} status="loading" />
        ) : (
          <DataTable {...table} rows={history.data} emptyText={t('console.gamesHistory.empty')}
            filter={{ label: t('console.gamesHistory.filter'), text: (row) => row.tableName }} initialSort={{ key: 'day', direction: 'descending' }} />
        )}
      </Stack>
    </Screen>
  );
}
