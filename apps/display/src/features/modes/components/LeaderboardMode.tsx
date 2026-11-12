import { useTvLeaderboard, type TvLeaderboardRow } from '@rivr/db';
import { formatHoursMinutes, t } from '@rivr/i18n';
import { TvWaitlistBoard, type TvWaitlistStake } from '@rivr/ui';
import { BoardStatus } from './BoardStatus.tsx';
import { isEmptyBoard, useSkipWhenEmpty } from './useSkipWhenEmpty.ts';

// A column holds six rows at the TV's size (TvWaitlistBoard), so the setting's most, twelve, fill two.
const PER_COLUMN = 6;

/** A first name and initial, or "Member #17" for a member who hid their name on the TVs (the owner, 12 Nov; decision 0581). */
function nameOf(row: TvLeaderboardRow): string {
  if (row.name !== null) return row.name;
  return row.memberNumber === null ? t('tv.hiddenName') : t('tv.leaderboard.member', { number: String(row.memberNumber) });
}

/** The board as columns of six, each headed by the period and its places, every row with the hours and minutes played. */
export function toLeaderboardColumns(rows: readonly TvLeaderboardRow[]): TvWaitlistStake[] {
  const first = rows[0];
  if (first === undefined) return [];
  const period = t(`tv.leaderboard.periods.${first.period}`);
  const columns = [rows.slice(0, PER_COLUMN), rows.slice(PER_COLUMN)].filter((part) => part.length > 0);
  return columns.map((part, column) => ({
    id: `column-${column}`, stake: period,
    detail: t('tv.leaderboard.places', { from: column * PER_COLUMN + 1, to: column * PER_COLUMN + part.length }),
    places: part.map((row, index) => ({
      id: `column-${column}-${index}`, place: String(row.place), name: nameOf(row), status: formatHoursMinutes(row.minutes * 60),
    })),
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
