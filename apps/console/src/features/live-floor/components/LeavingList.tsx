import { useSeatActions, type FloorTable, type SeatedPlayer, type SeatFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, CallTimeTimer, ConfirmButton, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { SEAT_FAILURE_COPY } from './seatCopy.ts';

interface LeavingListProps {
  venueId: string;
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  /** The floor (waitlist.manage) can take a leaving back. */
  isFloor: boolean;
}

type Report = (outcome: { ok: true } | { ok: false; error: SeatFailure }) => void;

/** One player leaving: where, the call time still owed or none; for the floor, Leave once it is done (decision 0302), and Not leaving. */
function LeavingRow({ venueId, player, tableName, isFloor, report }: { venueId: string; player: SeatedPlayer; tableName: string; isFloor: boolean; report: Report }) {
  const { setLeaving, leave } = useSeatActions(venueId);
  const isDone = (player.callTimeLeft ?? 0) === 0;
  return (
    <Inline justify="between" align="center" wrap>
      <Inline gap={4} align="center">
        <Text>{player.fullName}</Text>
        <Text tone="muted">{t('console.liveFloor.leavingLine', { table: tableName, seat: player.seat })}</Text>
        {player.callTimeLeft === null
          ? <Text variant="small" tone="muted">{t('console.liveFloor.leavingNoCallTime')}</Text>
          : <CallTimeTimer secondsLeft={player.callTimeLeft} isPaused={player.isAway} />}
      </Inline>
      {isFloor ? (
        <Inline gap={2} align="center">
          {isDone ? (
            <ConfirmButton label={t('console.liveFloor.leave')} name={t('console.liveFloor.leaveName', { name: player.fullName })}
              confirm={t('console.liveFloor.confirmLeave', { name: player.fullName })} isBusy={leave.isPending}
              onConfirm={() => void leave.mutateAsync(player.sessionId).then(report)} />
          ) : null}
          <Button variant="text" aria-label={t('console.liveFloor.notLeavingName', { name: player.fullName })}
            onClick={() => void setLeaving.mutateAsync({ sessionId: player.sessionId, isLeaving: false }).then(report)}>
            {t('console.liveFloor.notLeaving')}
          </Button>
        </Inline>
      ) : null}
    </Inline>
  );
}

/**
 * On the Live floor (decision 0163): the players the floor marked leaving, the soonest seat to open
 * first, with the call time each still owes; once it is done, the floor lets them go (decision 0302). The TV's call-time
 * board shows the same seats opening. Nothing when nobody is leaving.
 */
export function LeavingList({ venueId, tables, seats, isFloor }: LeavingListProps) {
  const [failure, setFailure] = useState<SeatFailure | null>(null);
  const leaving = seats.filter((player) => player.leavingAt !== null).sort((a, b) => (a.callTimeLeft ?? 0) - (b.callTimeLeft ?? 0));
  if (leaving.length === 0) return null;
  const tableName = (tableId: string) => tables.find((table) => table.id === tableId)?.name ?? '';
  const report: Report = (outcome) => setFailure(outcome.ok ? null : outcome.error);
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.liveFloor.leavingTitle')}</Heading>
      <Stack gap={2} divided>
        {leaving.map((player) => (
          <LeavingRow key={player.sessionId} venueId={venueId} player={player} tableName={tableName(player.tableId)} isFloor={isFloor} report={report} />
        ))}
      </Stack>
      {failure === null ? null : <ErrorMessage>{t(SEAT_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
