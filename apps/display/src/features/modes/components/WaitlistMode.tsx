import { useTvWaitlistBoard, type TvPlace, type TvTableList } from '@rivr/db';
import { t } from '@rivr/i18n';
import { TvWaitlistBoard, type TvWaitlistStake } from '@rivr/ui';
import { usePage } from './usePage.ts';
import { BoardStatus } from './BoardStatus.tsx';

// Three tables to a screen; more take turns, a page every ten seconds, as the call-time board's do (decision 0467).
export const WAITLIST_TABLES_SHOWN = 3;

/** What a place says beside the name: the table it is called to, or that the player stepped away. */
function statusText(place: TvPlace): string | undefined {
  if (place.calledTo !== null) return t('tv.waitlist.called', { table: place.calledTo });
  return place.isAway ? t('tv.waitlist.away') : undefined;
}

/** A table's column: its name, its stake (and that it is closed while it is), and its places in order. */
export function toBoardColumn(table: TvTableList): TvWaitlistStake {
  return {
    id: table.tableId, stake: table.name, detail: table.isOpen ? table.stake : t('tv.waitlist.closed', { stake: table.stake }),
    places: table.places.map((place) => ({
      id: `${table.tableId}-${place.place}`, place: String(place.place),
      // A member who hid their name on the TVs is their place on the list, the name left blank (#326, F-137).
      name: place.name ?? '',
      status: statusText(place),
    })),
  };
}

/** The tables as the board lays them out (F-140): those with a list as columns, in order, and the open ones with none named on one line. */
export function arrangeTables(tables: readonly TvTableList[]): { withList: TvTableList[]; noList: string[] } {
  return { withList: tables.filter((table) => table.places.length > 0), noList: tables.filter((table) => table.places.length === 0).map((table) => table.name) };
}

/** The line at the board's foot: which page, and the tables with no list, whichever there are. */
export function footerOf(shown: number, pages: number, noList: readonly string[]): string | undefined {
  const page = pages < 2 ? undefined : t('tv.waitlist.page', { page: shown + 1, pages });
  const folded = noList.length === 0 ? undefined : t('tv.waitlist.noList', { tables: noList.join(', ') });
  return page !== undefined && folded !== undefined ? t('tv.waitlist.footer', { page, folded }) : page ?? folded;
}

/**
 * The waitlist board (#65): a list a table (decision 0467), each table somebody waits for, open or closed, live as players join,
 * are called and leave; more tables than fit take turns, and the open tables with no list are named at the foot.
 */
export function WaitlistMode() {
  const board = useTvWaitlistBoard();
  const { withList, noList } = arrangeTables(board.data ?? []);
  const pages = Math.ceil(withList.length / WAITLIST_TABLES_SHOWN);
  const shown = usePage(pages);
  const first = shown * WAITLIST_TABLES_SHOWN;
  if (board.data === undefined) {
    return <BoardStatus isError={board.isError} />;
  }
  return (
    <TvWaitlistBoard title={t('tv.waitlist.title')} emptyText={t('tv.waitlist.empty')} moreText={(count) => t('tv.more', { count })}
      stakes={withList.slice(first, first + WAITLIST_TABLES_SHOWN).map(toBoardColumn)}
      footer={withList.length === 0 ? undefined : footerOf(shown, pages, noList)} />
  );
}
