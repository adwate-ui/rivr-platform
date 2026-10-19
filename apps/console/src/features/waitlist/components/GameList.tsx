import { useFloorWaitlistActions, type FloorTable, type WaitlistBoardEntry, type WaitlistFailure } from '@rivr/db';
import { formatTime, t, type MessageKey } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Input, Stack, Stakes, Text } from '@rivr/ui';
import { useState } from 'react';

const FAILURE_COPY: Readonly<Record<WaitlistFailure, MessageKey>> = {
  not_open: 'console.waitlist.notOpen',
  kyc_needed: 'console.waitlist.kycNeeded',
  stopped: 'console.waitlist.stopped',
  no_member: 'console.waitlist.noMember',
  invalid: 'console.waitlist.invalid',
  unavailable: 'console.waitlist.unavailable',
};

interface GameListProps {
  venueId: string;
  game: FloorTable;
  entries: readonly WaitlistBoardEntry[];
}

/** One game and stake's list, in order, with Remove on each place and a way to add a member by their number. */
export function GameList({ venueId, game, entries }: GameListProps) {
  const { remove } = useFloorWaitlistActions(venueId);
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
            <Button variant="secondary" isLoading={remove.isPending} onClick={() => void remove.mutateAsync(entry.entryId)}>
              {t('console.waitlist.remove', { name: entry.fullName })}
            </Button>
          </Inline>
        ))}
      </Stack>
      <AddMember venueId={venueId} tableTypeId={game.tableTypeId} />
    </Stack>
  );
}

/** Adds a member to this list by their mobile number. */
function AddMember({ venueId, tableTypeId }: { venueId: string; tableTypeId: string }) {
  const { add } = useFloorWaitlistActions(venueId);
  const [phone, setPhone] = useState('');
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState<WaitlistFailure | null>(null);
  const submit = async () => {
    const added = await add.mutateAsync({ tableTypeId, phone, requestId });
    setFailure(added.ok ? null : added.error);
    if (added.ok) {
      setPhone('');
      setRequestId(crypto.randomUUID());
    }
  };
  return (
    <Stack gap={2}>
      <Inline gap={3} align="end">
        <Input label={t('console.waitlist.phone')} prefix="+91" type="tel" inputMode="tel" value={phone}
          onChange={(event) => setPhone(event.target.value)} autoComplete="off" />
        <Button variant="secondary" isLoading={add.isPending} onClick={() => void submit()}>{t('console.waitlist.add')}</Button>
      </Inline>
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
