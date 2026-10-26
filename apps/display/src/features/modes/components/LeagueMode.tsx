import { useTvLeagueBoard, type LeagueBoardRow } from '@rivr/db';
import { formatMonth, formatNumber, t } from '@rivr/i18n';
import { Text, TvWaitlistBoard, type TvWaitlistStake } from '@rivr/ui';

/** One column of the board: this month's places, or the season's, each a first name and initial and the points. */
function column(id: string, title: string, detail: string, rows: readonly LeagueBoardRow[]): TvWaitlistStake {
  return {
    id, stake: title, detail,
    places: rows.map((row, index) => ({
      id: `${id}-${index}`, place: String(row.place), name: row.name ?? t('tv.league.hiddenName'),
      status: t('tv.league.points', { points: formatNumber(row.points) }),
    })),
  };
}

/** The board as columns: this month always, and the season when one runs. */
export function toLeagueColumns(rows: readonly LeagueBoardRow[]): TvWaitlistStake[] {
  const month = rows.filter((row) => row.standing === 'month');
  const season = rows.filter((row) => row.standing === 'season');
  // The month is named from its standings; before anyone has points, the column says only "This month".
  const named = month[0] === undefined ? '' : formatMonth(month[0].firstMonth);
  const columns = [column('month', t('tv.league.thisMonth'), named, month)];
  const first = season[0];
  if (first === undefined) return columns;
  return [...columns, column('season', first.seasonName ?? t('tv.league.title'),
    t('tv.league.seasonMonths', { first: formatMonth(first.firstMonth), last: formatMonth(first.lastMonth) }), season)];
}

/** The League leaderboard (#148, decision 0182): this month's places and the season's, live as visits close and tournaments finish. */
export function LeagueMode() {
  const board = useTvLeagueBoard();
  if (board.data === undefined) {
    return <Text variant="tvBody" tone="muted">{t(board.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  return <TvWaitlistBoard title={t('tv.league.title')} emptyText={t('tv.league.empty')} stakes={toLeagueColumns(board.data)} />;
}
