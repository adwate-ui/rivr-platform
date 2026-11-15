import { useTvCallTimeBoard, type TvCallTimeTable, type TvSeated } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { TvCallTimeBoard, type TvCallTimeSeat } from '@rivr/ui';
import { useEffect, useState } from 'react';
import { BoardStatus } from './BoardStatus.tsx';

/** The time now, a second at a time: the board counts down between reads. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);
  return now;
}

/** A player's seconds of call time left now, `elapsed` seconds after the board was read; the clock stands still while they are away. */
function leftNow(player: TvSeated, elapsed: number): number {
  const left = player.callTimeLeft ?? 0;
  return player.isAway ? left : Math.max(0, left - elapsed);
}

/** What a seat says at the right: "Now" once a leaving player's call time is done, "Away" while the clock stands still, or the time left. */
function timeText(player: TvSeated, left: number): string {
  if (left === 0) return t('tv.callTime.opensNow');
  return player.isAway ? t('tv.callTime.away') : formatDuration(left);
}

/**
 * Every seat on call time as one list, soonest first: each player with call time left, and each the floor marked leaving
 * whose call time is done, whose seat opens now. A member who hid their name on the TVs is their seat, the name left
 * blank (#326, F-137).
 */
export function toSeats(tables: readonly TvCallTimeTable[], elapsed: number): TvCallTimeSeat[] {
  return tables
    .flatMap((table) => table.seated.map((player) => ({ table, player, left: leftNow(player, elapsed) })))
    .filter(({ player, left }) => left > 0 || player.isLeaving)
    .sort((a, b) => a.left - b.left)
    .map(({ table, player, left }) => ({
      id: `${table.tableId}-${String(player.seat)}`, where: t('tv.callTime.where', { table: table.name, seat: player.seat }),
      name: player.name ?? '', time: timeText(player, left),
    }));
}

/**
 * The call-time board (decision 0163), titled Seats opening on the TV: every seat on call time in one list, soonest
 * first, counting down between reads.
 */
export function CallTimeMode() {
  const board = useTvCallTimeBoard();
  const now = useNow();
  if (board.data === undefined) {
    return <BoardStatus isError={board.isError} />;
  }
  const elapsed = Math.max(0, Math.floor((now - board.dataUpdatedAt) / 1_000));
  return (
    <TvCallTimeBoard title={t('tv.callTime.title')} emptyText={t('tv.callTime.empty')} moreText={(count) => t('tv.more', { count })}
      seats={toSeats(board.data, elapsed)} />
  );
}
