import { useFeature, useWaitlistActions, type FloorTable, type WaitlistFailure, type WaitlistPlace } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, FloorRow, Stack } from '@rivr/ui';
import { useState } from 'react';
import { WAITLIST_FAILURE_COPY } from './waitlistCopy.ts';

/** The line under a table: closed, how many wait, or the member's own place on its list. */
function detailOf(table: FloorTable, place: WaitlistPlace | undefined): string {
  if (!table.isOpen) return t('player.tonight.closed');
  if (place) return t('player.tonight.onTheList', { count: table.waiting, place: place.place });
  return table.waiting === 0 ? t('player.tonight.noWait') : t('player.tonight.waiting', { count: table.waiting });
}

/** Tonight's tables in floor order, each with Join while the member may join and is not on its list. */
export function FloorList({ tables, places }: { tables: readonly FloorTable[]; places: readonly WaitlistPlace[] }) {
  const canJoin = useFeature('waitlist.join').state === 'enabled';
  const { join } = useWaitlistActions();
  // One request id per tap that has not gone through, so a retried tap joins once.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const joinList = async (tableTypeId: string) => {
    const joined = await join.mutateAsync({ tableTypeId, requestId });
    setFailure(joined.ok ? null : joined.error);
    if (joined.ok) setRequestId(crypto.randomUUID());
  };
  return (
    <Stack gap={4}>
      {failure === null ? null : <ErrorMessage>{t(WAITLIST_FAILURE_COPY[failure])}</ErrorMessage>}
      <Stack gap={4} divided>
        {tables.map((table) => {
          const place = places.find((candidate) => candidate.tableTypeId === table.tableTypeId);
          const action = canJoin && table.isOpen && !place ? (
            <Button variant="secondary" isLoading={join.isPending} onClick={() => void joinList(table.tableTypeId)}>
              {t('player.tonight.join')}
            </Button>
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
