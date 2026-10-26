import { useTvWaitlistBoard, type TvPlace, type TvStake } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Text, TvWaitlistBoard, type TvWaitlistStake } from '@rivr/ui';

/** What a place says beside the name: the table it is called to, or that the player stepped away. */
function statusText(place: TvPlace): string | undefined {
  if (place.calledTo !== null) return t('tv.waitlist.called', { table: place.calledTo });
  return place.isAway ? t('tv.waitlist.away') : undefined;
}

function openText(tables: number): string {
  if (tables === 0) return t('tv.waitlist.noTablesOpen');
  return tables === 1 ? t('tv.waitlist.oneTableOpen') : t('tv.waitlist.tablesOpen', { count: tables });
}

function toBoardStake(stake: TvStake): TvWaitlistStake {
  return {
    id: stake.tableTypeId, stake: stake.name, detail: openText(stake.openTables),
    places: stake.places.map((place) => ({
      id: `${stake.tableTypeId}-${place.place}`, place: String(place.place),
      // A member who hid their name on the TVs is their place on the list (#326).
      name: place.name ?? t('tv.waitlist.hiddenName', { place: place.place }),
      status: statusText(place),
    })),
  };
}

/** The waitlist board (#65): every stake with its places, live as players join, are called and leave. */
export function WaitlistMode() {
  const board = useTvWaitlistBoard();
  if (board.data === undefined) {
    return <Text variant="tvBody" tone="muted">{t(board.isError ? 'display.screen.unavailable' : 'common.loading')}</Text>;
  }
  return <TvWaitlistBoard title={t('tv.waitlist.title')} emptyText={t('tv.waitlist.empty')} stakes={board.data.map(toBoardStake)} />;
}
