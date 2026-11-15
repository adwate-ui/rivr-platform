import { useTvWaitlistBoard, type TvPlace, type TvTableList } from '@rivr/db';
import { formatStakeName, t } from '@rivr/i18n';
import { TV_WAITLIST_TABLES_SHOWN, TvWaitlistBoard, type TvWaitlistStake } from '@rivr/ui';
import { BoardStatus } from './BoardStatus.tsx';
import { usePage } from './usePage.ts';

/** What a place says under the name: the table it is called to, or that the player stepped away. */
function statusText(place: TvPlace): string | undefined {
  if (place.calledTo !== null) return t('tv.waitlist.called', { table: place.calledTo });
  return place.isAway ? t('tv.waitlist.away') : undefined;
}

/** A table's column: its name, its stake (and that it is closed while it is), and its places in order. */
export function toBoardColumn(table: TvTableList): TvWaitlistStake {
  // The stake as its name, with the figures once it has a straddle (issue 990).
  const stake = formatStakeName(table.stake, table);
  return {
    id: table.tableId, stake: table.name, detail: table.isOpen ? stake : t('tv.waitlist.closed', { stake }),
    places: table.places.map((place) => ({
      id: `${table.tableId}-${place.place}`, place: String(place.place),
      // A member who hid their name on the TVs is their place on the list, the name left blank (#326, F-137).
      name: place.name ?? '',
      status: statusText(place),
    })),
  };
}

/** The tables the board gives a column: those somebody waits for, in the floor's order. A table with no list is not on it. */
export const tablesWithList = (tables: readonly TvTableList[]) => tables.filter((table) => table.places.length > 0);

/**
 * The waitlist board (#65): a list a table (decision 0467), each table somebody waits for, open or closed, live as players
 * join, are called and leave. More tables than the board holds take turns, a page every ten seconds.
 */
export function WaitlistMode() {
  const board = useTvWaitlistBoard();
  const tables = tablesWithList(board.data ?? []);
  const pages = Math.ceil(tables.length / TV_WAITLIST_TABLES_SHOWN);
  const shown = usePage(pages);
  if (board.data === undefined) {
    return <BoardStatus isError={board.isError} />;
  }
  const first = shown * TV_WAITLIST_TABLES_SHOWN;
  return (
    <TvWaitlistBoard title={t('tv.waitlist.title')} emptyText={t('tv.waitlist.empty')} moreText={(count) => t('tv.more', { count })}
      stakes={tables.slice(first, first + TV_WAITLIST_TABLES_SHOWN).map(toBoardColumn)}
      footer={pages < 2 ? undefined : t('tv.waitlist.page', { page: shown + 1, pages })} />
  );
}
