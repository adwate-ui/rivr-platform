import { useSeatActions, type FloorTable, type SeatedPlayer, type SeatFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, CallTimeTimer, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { SEAT_FAILURE_COPY } from './seatCopy.ts';

interface LeavingListProps {
  venueId: string;
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  /** The floor (waitlist.manage) can take a leaving back. */
  isFloor: boolean;
}

/**
 * On the Live floor (decision 0163): the players the floor marked leaving, the soonest seat to open
 * first, with the call time each still owes. The TV's call-time board shows the same seats opening.
 * Nothing when nobody is leaving.
 */
export function LeavingList({ venueId, tables, seats, isFloor }: LeavingListProps) {
  const { setLeaving } = useSeatActions(venueId);
  const [failure, setFailure] = useState<SeatFailure | null>(null);
  const leaving = seats.filter((player) => player.leavingAt !== null).sort((a, b) => (a.callTimeLeft ?? 0) - (b.callTimeLeft ?? 0));
  if (leaving.length === 0) return null;
  const tableName = (tableId: string) => tables.find((table) => table.id === tableId)?.name ?? '';
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.liveFloor.leavingTitle')}</Heading>
      <Stack gap={2} divided>
        {leaving.map((player) => (
          <Inline key={player.sessionId} justify="between" align="center">
            <Inline gap={4} align="center">
              <Text>{player.fullName}</Text>
              <Text tone="muted">{t('console.liveFloor.leavingLine', { table: tableName(player.tableId), seat: player.seat })}</Text>
              {player.callTimeLeft === null
                ? <Text variant="small" tone="muted">{t('console.liveFloor.leavingNoCallTime')}</Text>
                : <CallTimeTimer secondsLeft={player.callTimeLeft} isPaused={player.isAway} />}
            </Inline>
            {isFloor ? (
              <Button variant="text" aria-label={t('console.liveFloor.notLeavingName', { name: player.fullName })}
                onClick={() => void setLeaving.mutateAsync({ sessionId: player.sessionId, isLeaving: false })
                  .then((outcome) => setFailure(outcome.ok ? null : outcome.error))}>
                {t('console.liveFloor.notLeaving')}
              </Button>
            ) : null}
          </Inline>
        ))}
      </Stack>
      {failure === null ? null : <ErrorMessage>{t(SEAT_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
