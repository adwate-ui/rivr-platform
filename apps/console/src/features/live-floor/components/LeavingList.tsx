import { useSeatActions, type FloorTable, type SeatedPlayer, type SeatFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, CallTimeTimer, ConfirmButton, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { EarlyLeaveForm } from './EarlyLeaveForm.tsx';
import { SEAT_FAILURE_COPY } from './seatCopy.ts';

interface LeavingListProps {
  venueId: string;
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  /** The floor (waitlist.manage) lets a leaving go, or takes it back. */
  isFloor: boolean;
  /** Staff with the override (call_time.override) let one who still owes call time go early, with a reason (#79). */
  canLetGoEarly: boolean;
}

type Report = (outcome: { ok: true } | { ok: false; error: SeatFailure }) => void;

interface LeavingRowProps {
  venueId: string;
  player: SeatedPlayer;
  tableName: string;
  isFloor: boolean;
  canLetGoEarly: boolean;
  report: Report;
  onLeaveEarly: () => void;
}

/**
 * One player leaving: where, and the call time still owed or none; for the floor, Leave and Not leaving. Leave works as
 * on the seat's row (decision 0306): with the call time done it frees the seat; with time owed, staff with the override
 * let them go early with a reason, and anyone else frees the seat owing.
 */
function LeavingRow({ venueId, player, tableName, isFloor, canLetGoEarly, report, onLeaveEarly }: LeavingRowProps) {
  const { setLeaving, leave } = useSeatActions(venueId);
  const isOwing = (player.callTimeLeft ?? 0) > 0;
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
          {isOwing && canLetGoEarly ? (
            <Button variant="text" aria-label={t('console.liveFloor.leaveName', { name: player.fullName })} onClick={onLeaveEarly}>{t('console.liveFloor.leave')}</Button>
          ) : (
            <ConfirmButton label={t('console.liveFloor.leave')} name={t('console.liveFloor.leaveName', { name: player.fullName })}
              confirm={t('console.liveFloor.confirmLeave', { name: player.fullName })} isBusy={leave.isPending}
              onConfirm={() => void leave.mutateAsync(player.sessionId).then(report)} />
          )}
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
 * On the Live floor (decision 0163): the players marked leaving, the soonest seat to open first, with the call time each
 * still owes; the floor lets each go from here, owing or not (decision 0306), or takes the leaving back. The TV's
 * call-time board shows the same seats opening. Nothing when nobody is leaving.
 */
export function LeavingList({ venueId, tables, seats, isFloor, canLetGoEarly }: LeavingListProps) {
  const [failure, setFailure] = useState<SeatFailure | null>(null);
  const [goingEarly, setGoingEarly] = useState<SeatedPlayer | null>(null);
  const leaving = seats.filter((player) => player.leavingAt !== null).sort((a, b) => (a.callTimeLeft ?? 0) - (b.callTimeLeft ?? 0));
  if (leaving.length === 0 && goingEarly === null) return null;
  const tableName = (tableId: string) => tables.find((table) => table.id === tableId)?.name ?? '';
  const report: Report = (outcome) => setFailure(outcome.ok ? null : outcome.error);
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('console.liveFloor.leavingTitle')}</Heading>
      <Stack gap={2} divided>
        {leaving.map((player) => (
          <LeavingRow key={player.sessionId} venueId={venueId} player={player} tableName={tableName(player.tableId)} isFloor={isFloor}
            canLetGoEarly={canLetGoEarly} report={report} onLeaveEarly={() => { setFailure(null); setGoingEarly(player); }} />
        ))}
      </Stack>
      {goingEarly === null ? null : (
        <EarlyLeaveForm key={goingEarly.sessionId} venueId={venueId} onDone={report} onCancel={() => setGoingEarly(null)}
          member={{ memberId: goingEarly.memberId, fullName: goingEarly.fullName, owed: goingEarly.callTimeLeft ?? 0, sessionId: goingEarly.sessionId }} />
      )}
      {failure === null ? null : <ErrorMessage>{t(SEAT_FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
