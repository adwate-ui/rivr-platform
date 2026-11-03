import { useTvWaitlistBoard, type TvPlace, type TvTableList } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Text, TvWaitlistBoard, type TvWaitlistStake } from '@rivr/ui';
import { usePage } from './usePage.ts';

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
      // A member who hid their name on the TVs is their place on the list (#326).
      name: place.name ?? t('tv.waitlist.hiddenName', { place: place.place }),
      status: statusText(place),
    })),
  };
}

/**
 * The waitlist board (#65): a list a table (decision 0467), every open table and a closed one somebody waits for, live as
 * players join, are called and leave; more tables than fit take turns.
 */
export function WaitlistMode() {
  const board = useTvWaitlistBoard();
  const tables = board.data ?? [];
  const pages = Math.ceil(tables.length / WAITLIST_TABLES_SHOWN);
  const first = usePage(pages) * WAITLIST_TABLES_SHOWN;
  if (board.data === undefined) {
    return <Text variant="tvBody" tone="muted">{t(board.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  return (
    <TvWaitlistBoard title={t('tv.waitlist.title')} emptyText={t('tv.waitlist.empty')}
      stakes={tables.slice(first, first + WAITLIST_TABLES_SHOWN).map(toBoardColumn)} />
  );
}
