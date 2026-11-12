import { useTvLeaderboard, type TvLeaderboardRow } from '@rivr/db';
import { formatHoursMinutes, t } from '@rivr/i18n';
import { TvWaitlistBoard, tvPlacesThatFit, type TvWaitlistPlace, type TvWaitlistStake } from '@rivr/ui';
import { BoardStatus } from './BoardStatus.tsx';
import { isEmptyBoard, useSkipWhenEmpty } from './useSkipWhenEmpty.ts';

// One list across the board's two columns.
const COLUMNS = 2;

/** A first name and initial, or "Member #17" for a member who hid their name on the TVs (the owner, 12 Nov; decision 0581). */
function nameOf(row: TvLeaderboardRow): string {
  if (row.name !== null) return row.name;
  return row.memberNumber === null ? t('tv.hiddenName') : t('tv.leaderboard.member', { number: String(row.memberNumber) });
}

/** The places a column shows, as ranked: `Places 1 to 6`, or `Place 1` where all are tied. */
function placesText(rows: readonly TvLeaderboardRow[]): string {
  const from = rows[0]?.place ?? 0;
  const to = rows.at(-1)?.place ?? from;
  return from === to ? t('tv.leaderboard.place', { place: from }) : t('tv.leaderboard.places', { from, to });
}

/**
 * The board as one list down two columns, each headed by the period and the places it shows, every row with the hours and
 * minutes played. Column one takes only what the stage holds (a long name takes two lines), so no place is hidden between the
 * columns; the rest go to column two, any it cannot hold under "+N more".
 */
export function toLeaderboardColumns(rows: readonly TvLeaderboardRow[]): TvWaitlistStake[] {
  const first = rows[0];
  if (first === undefined) return [];
  const period = t(`tv.leaderboard.periods.${first.period}`);
  const places: TvWaitlistPlace[] = rows.map((row, index) => ({
    id: `place-${String(index)}`, place: String(row.place), name: nameOf(row), status: formatHoursMinutes(row.minutes * 60),
  }));
  const fits = (from: number, to: number) => tvPlacesThatFit({ id: 'fit', stake: period, detail: placesText(rows.slice(from, to)), places: places.slice(from, to) }, COLUMNS);
  const inFirst = fits(0, rows.length);
  const columns = [[0, inFirst], [inFirst, rows.length]].filter(([from = 0, to = 0]) => to > from);
  return columns.map(([from = 0, to = 0], column) => ({
    id: `column-${String(column)}`, stake: period, detail: placesText(rows.slice(from, from + fits(from, to))), places: places.slice(from, to),
  }));
}

/** The hours leaderboard (decision 0581): members by the hours they played in the period the club set, read every half minute. */
export function LeaderboardMode({ onEmpty }: { onEmpty?: (() => void) | undefined }) {
  const board = useTvLeaderboard();
  const stakes = board.data === undefined ? undefined : toLeaderboardColumns(board.data);
  useSkipWhenEmpty(stakes !== undefined && isEmptyBoard(stakes), onEmpty);
  if (board.data === undefined) {
    return <BoardStatus isError={board.isError} />;
  }
  return <TvWaitlistBoard title={t('tv.leaderboard.title')} emptyText={t('tv.leaderboard.empty')} moreText={(count) => t('tv.more', { count })} stakes={stakes ?? []} />;
}
