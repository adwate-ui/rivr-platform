import type { TvLeaderboardPeriod } from '@rivr/contracts';
import { useTvLeaderboard, type TvLeaderboardRow } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { TvHoursBoard, type TvHoursList } from '@rivr/ui';
import { BoardStatus } from './BoardStatus.tsx';
import { useSkipWhenEmpty } from './useSkipWhenEmpty.ts';

/** A first name and initial, or "Member #17" for a member who hid their name on the TVs (the owner, 12 Nov; decision 0581). */
function nameOf(row: TvLeaderboardRow): string {
  if (row.name !== null) return row.name;
  return row.memberNumber === null ? t('tv.hiddenName') : t('tv.leaderboard.member', { number: String(row.memberNumber) });
}

/**
 * The board's lists, tonight's first and then the longer period's as the rows come (redesign RD-28): each headed by its
 * period, every row with its place and the time played in the one form for a length of time. Tonight keeps its list while
 * nobody has played yet tonight, to say so; with no rows at all there is none, and the board says so or passes on.
 */
export function toLeaderboardLists(rows: readonly TvLeaderboardRow[]): TvHoursList[] {
  if (rows.length === 0) return [];
  const periods = [...new Set<TvLeaderboardPeriod>(['tonight', ...rows.map((row) => row.period)])];
  return periods.map((period) => ({
    id: period, caption: t(`tv.leaderboard.periods.${period}`),
    rows: rows.filter((row) => row.period === period).map((row, index) => ({
      id: `${period}-${String(index)}`, place: String(row.place), name: nameOf(row), time: formatDuration(row.minutes * 60),
    })),
  }));
}

/** The hours leaderboard (decision 0581): members by the hours they played tonight and in the period the club set, read every half minute. */
export function LeaderboardMode({ onEmpty }: { onEmpty?: (() => void) | undefined }) {
  const board = useTvLeaderboard();
  useSkipWhenEmpty(board.data?.length === 0, onEmpty);
  if (board.data === undefined) {
    return <BoardStatus isError={board.isError} />;
  }
  return (
    <TvHoursBoard title={t('tv.leaderboard.title')} emptyText={t('tv.leaderboard.empty')} moreText={(count) => t('tv.more', { count })}
      lists={toLeaderboardLists(board.data)} />
  );
}
