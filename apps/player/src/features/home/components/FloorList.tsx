import { useFeature, useWaitlistActions, type FloorTable, type WaitlistFailure, type WaitlistPlace } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, FeatureGate, FloorRow, LockedNotice, Stack, type FeatureAccess } from '@rivr/ui';
import { useState } from 'react';
import { WAITLIST_FAILURE_COPY } from './waitlistCopy.ts';

/** The line under a table: closed, how many wait, or the member's own place on its list. */
function detailOf(table: FloorTable, place: WaitlistPlace | undefined): string {
  if (!table.isOpen) return t('player.tonight.closed');
  if (place) return t('player.tonight.onTheList', { count: table.waiting, place: place.place });
  return table.waiting === 0 ? t('player.tonight.noWait') : t('player.tonight.waiting', { count: table.waiting });
}

/** A request id for each game, kept until joining it goes through, so a retried tap joins once. */
function useRequestIds() {
  const [ids, setIds] = useState<ReadonlyMap<string, string>>(new Map());
  const idFor = (tableTypeId: string) => ids.get(tableTypeId) ?? crypto.randomUUID();
  const keep = (tableTypeId: string, id: string) => setIds((current) => new Map(current).set(tableTypeId, id));
  const forget = (tableTypeId: string) => setIds((current) => new Map([...current].filter(([key]) => key !== tableTypeId)));
  return { idFor, keep, forget };
}

/**
 * Tonight's tables in floor order, each with Join while the member may join (waitlist.join) and is
 * not on its list. Where the member's tier lacks Join, one locked notice says which tiers have it.
 */
export function FloorList({ tables, places }: { tables: readonly FloorTable[]; places: readonly WaitlistPlace[] }) {
  const joinAccess = useFeature('waitlist.join');
  const { join } = useWaitlistActions();
  const requests = useRequestIds();
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const joinList = async (tableTypeId: string) => {
    const requestId = requests.idFor(tableTypeId);
    requests.keep(tableTypeId, requestId);
    const joined = await join.mutateAsync({ tableTypeId, requestId });
    setFailure(joined.ok ? null : joined.error);
    if (joined.ok) requests.forget(tableTypeId);
  };
  // The notice shows once above the list; each row's Join is simply absent while locked.
  const rowAccess: FeatureAccess = joinAccess.state === 'locked' ? { state: 'hidden' } : joinAccess;
  return (
    <Stack gap={4}>
      {joinAccess.state === 'locked' ? <LockedNotice tiers={joinAccess.tiers} /> : null}
      {failure === null ? null : <ErrorMessage>{t(WAITLIST_FAILURE_COPY[failure])}</ErrorMessage>}
      <Stack gap={4} divided>
        {tables.map((table) => {
          const place = places.find((candidate) => candidate.tableTypeId === table.tableTypeId);
          const action = table.isOpen && !place ? (
            <FeatureGate access={rowAccess}>
              <Button variant="secondary" isLoading={join.isPending} onClick={() => void joinList(table.tableTypeId)}>
                {t('player.tonight.join')}
              </Button>
            </FeatureGate>
          ) : undefined;
          return (
            <FloorRow key={table.id} name={table.name} smallBlind={table.smallBlind} bigBlind={table.bigBlind}
              detail={detailOf(table, place)} action={action} isMuted={!table.isOpen} />
          );
        })}
      </Stack>
    </Stack>
  );
}
