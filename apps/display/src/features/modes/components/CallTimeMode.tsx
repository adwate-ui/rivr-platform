import { useTvCallTimeBoard, type TvCallTimeTable, type TvSeated } from '@rivr/db';
import { formatDuration, t } from '@rivr/i18n';
import { CALL_TIME_TABLES_SHOWN, Text, TvCallTimeBoard, type TvCallTimeGroup, type TvCallTimeOpening } from '@rivr/ui';
import { useEffect, useState } from 'react';

// More tables than fit take turns, a page every ten seconds.
const PAGE_MS = 10_000;

/** Which page of tables shows: the next every ten seconds, round them all. */
function usePage(pages: number): number {
  const [turn, setTurn] = useState(0);
  useEffect(() => {
    if (pages < 2) return undefined;
    const timer = setInterval(() => setTurn((current) => current + 1), PAGE_MS);
    return () => clearInterval(timer);
  }, [pages]);
  return pages === 0 ? 0 : turn % pages;
}

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

function nameOf(player: TvSeated): string {
  // A member who hid their name on the TVs is their seat (#326).
  return player.name ?? t('tv.callTime.hiddenName', { seat: player.seat });
}

/** The players the floor marked leaving, soonest seat first: their seat opens once their call time is done. */
export function toOpenings(tables: readonly TvCallTimeTable[], elapsed: number): TvCallTimeOpening[] {
  return tables
    .flatMap((table) => table.seated.filter((player) => player.isLeaving).map((player) => ({ table, player, left: leftNow(player, elapsed) })))
    .sort((a, b) => a.left - b.left)
    .map(({ table, player, left }) => ({
      id: `${table.tableId}-${player.seat}`, where: t('tv.callTime.where', { table: table.name, seat: player.seat }), name: nameOf(player),
      time: left === 0 ? t('tv.callTime.opensNow') : t('tv.callTime.opensIn', { time: formatDuration(left) }), isNow: left === 0,
    }));
}

/** Every table with players still on call time and not leaving, each with the time left, soonest first. */
export function toGroups(tables: readonly TvCallTimeTable[], elapsed: number): TvCallTimeGroup[] {
  return tables
    .map((table) => ({
      id: table.tableId, name: table.name, detail: table.stake,
      rows: table.seated
        .filter((player) => !player.isLeaving && player.callTimeLeft !== null && leftNow(player, elapsed) > 0)
        .map((player) => ({ player, left: leftNow(player, elapsed) }))
        .sort((a, b) => a.left - b.left)
        .map(({ player, left }) => ({
          id: String(player.seat), seat: String(player.seat), name: nameOf(player),
          time: player.isAway ? t('tv.callTime.paused', { time: formatDuration(left) }) : formatDuration(left),
        })),
    }))
    .filter((group) => group.rows.length > 0);
}

/**
 * The call-time board (decision 0163): the seats about to open, and every table's players on call time,
 * counting down; more tables than fit take turns, a page every ten seconds.
 */
export function CallTimeMode() {
  const board = useTvCallTimeBoard();
  const now = useNow();
  const elapsed = Math.max(0, Math.floor((now - board.dataUpdatedAt) / 1_000));
  const groups = board.data === undefined ? [] : toGroups(board.data, elapsed);
  const pages = Math.ceil(groups.length / CALL_TIME_TABLES_SHOWN);
  const first = usePage(pages) * CALL_TIME_TABLES_SHOWN;
  if (board.data === undefined) {
    return <Text variant="tvBody" tone="muted">{t(board.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  const shown = groups.slice(first, first + CALL_TIME_TABLES_SHOWN);
  const page = pages < 2 ? undefined : t('tv.callTime.page', { from: first + 1, to: first + shown.length, count: groups.length });
  return (
    <TvCallTimeBoard title={t('tv.callTime.title')} openingsTitle={t('tv.callTime.openingsTitle')} noOpeningsText={t('tv.callTime.noOpenings')}
      emptyText={t('tv.callTime.empty')} moreText={(count) => t('tv.callTime.more', { count })} page={page}
      openings={toOpenings(board.data, elapsed)} tables={shown} />
  );
}
