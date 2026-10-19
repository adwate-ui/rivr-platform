import { useFloorWaitlistActions, type FloorTable, type WaitlistBoardEntry, type WaitlistFailure } from '@rivr/db';
import { formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Stakes, Text } from '@rivr/ui';
import { useState } from 'react';
import { AddMemberForm } from './AddMemberForm.tsx';
import { FAILURE_COPY } from './failureCopy.ts';

interface GameListProps {
  venueId: string;
  game: FloorTable;
  entries: readonly WaitlistBoardEntry[];
}

/** One game and stake's list, in order, with Remove on each place and a way to add a member by their number. */
export function GameList({ venueId, game, entries }: GameListProps) {
  const { remove } = useFloorWaitlistActions(venueId);
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const removePlace = async (entryId: string) => {
    const removed = await remove.mutateAsync(entryId);
    setFailure(removed.ok ? null : removed.error);
  };
  return (
    <Stack gap={4}>
      <Inline gap={3} align="baseline">
        <Heading level={2}>{game.tableTypeName}</Heading>
        <Stakes smallBlind={game.smallBlind} bigBlind={game.bigBlind} tone="muted" />
      </Inline>
      {entries.length === 0 ? <Text tone="muted">{t('console.waitlist.empty')}</Text> : null}
      <Stack gap={3} divided>
        {entries.map((entry) => (
          <Inline key={entry.entryId} gap={4} align="center" justify="between">
            <Stack gap={1}>
              <Text>{t('console.waitlist.entry', { place: entry.place, name: entry.fullName, time: formatTime(new Date(entry.joinedAt)) })}</Text>
              {entry.addedByFloor ? <Text variant="small" tone="muted">{t('console.waitlist.addedByFloor')}</Text> : null}
            </Stack>
            <Button variant="secondary" isLoading={remove.isPending} onClick={() => void removePlace(entry.entryId)}>
              {t('console.waitlist.remove', { name: entry.fullName })}
            </Button>
          </Inline>
        ))}
      </Stack>
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
      <AddMemberForm venueId={venueId} tableTypeId={game.tableTypeId} />
    </Stack>
  );
}
