import { useSeatActions, type FloorTable, type HeldSeat, type SeatedPlayer, type SeatFailure, type TableNight } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, CallTimeTimer, ErrorMessage, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { EarlyLeaveForm } from './EarlyLeaveForm.tsx';
import { MoveForm } from './MoveForm.tsx';
import { RecentHands } from './RecentHands.tsx';
import { SEAT_FAILURE_COPY } from './seatCopy.ts';
import { SeatForm } from './SeatForm.tsx';
import { TableControls } from './TableControls.tsx';
import { TableHeader } from './TableHeader.tsx';

interface TableDetailProps {
  venueId: string;
  table: FloorTable;
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  held: readonly HeldSeat[];
  permissions: readonly string[];
  /** The table's night so far; undefined until it is read. */
  night: TableNight | undefined;
}

/** One seat's row, as in the prototype: who sits there and their tier, their must-move turn, away, their call time left (#78), held for a waitlist call, or Open. */
function SeatLine({ number, player, heldFor, isOpen }: { number: number; player: SeatedPlayer | undefined; heldFor: HeldSeat | undefined; isOpen: boolean }) {
  if (player === undefined) {
    const free = isOpen ? t('console.liveFloor.seatOpen') : t('console.liveFloor.seatFree');
    const state = heldFor === undefined ? free : t('console.liveFloor.heldFor', { name: heldFor.fullName });
    return <Inline gap={4}><Text tone="muted">{number}</Text><Text tone="muted">{state}</Text></Inline>;
  }
  return (
    <Inline gap={4} align="center">
      <Text tone="muted">{number}</Text>
      <Text>{player.fullName}</Text>
      <Text tone="muted">{player.tierName}</Text>
      {player.mustMoveOrder === null ? null : <Text variant="small" tone="muted">{t('console.liveFloor.mustMove', { order: player.mustMoveOrder })}</Text>}
      {player.isAway ? <Text variant="small" tone="muted">{t('console.liveFloor.away')}</Text> : null}
      {player.leavingAt === null ? null : <Text variant="small" weight="semibold">{t('console.liveFloor.leaving')}</Text>}
      {player.callTimeLeft === null ? null : <CallTimeTimer secondsLeft={player.callTimeLeft} isPaused={player.isAway} />}
    </Inline>
  );
}

interface SeatButtonsProps {
  player: SeatedPlayer;
  canLetGoEarly: boolean;
  onMove: () => void;
  onLeave: () => void;
  onLeaveEarly: () => void;
  onLeaving: (isLeaving: boolean) => void;
}

/**
 * The floor's buttons on a seated player's row: mark them leaving or take it back (decision 0163), move,
 * leave, and for admins, leave early while call time is owed (#79).
 */
function SeatButtons({ player, canLetGoEarly, onMove, onLeave, onLeaveEarly, onLeaving }: SeatButtonsProps) {
  const isLeaving = player.leavingAt !== null;
  return (
    <Inline gap={2}>
      <Button variant="text" aria-label={t(isLeaving ? 'console.liveFloor.notLeavingName' : 'console.liveFloor.markLeavingName', { name: player.fullName })}
        onClick={() => onLeaving(!isLeaving)}>
        {t(isLeaving ? 'console.liveFloor.notLeaving' : 'console.liveFloor.markLeaving')}
      </Button>
      <Button variant="text" aria-label={t('console.liveFloor.moveName', { name: player.fullName })} onClick={onMove}>{t('console.liveFloor.move')}</Button>
      <Button variant="text" aria-label={t('console.liveFloor.leaveName', { name: player.fullName })} onClick={onLeave}>{t('console.liveFloor.leave')}</Button>
      {canLetGoEarly && (player.callTimeLeft ?? 0) > 0 ? (
        <Button variant="text" aria-label={t('console.liveFloor.leaveEarlyName', { name: player.fullName })} onClick={onLeaveEarly}>
          {t('console.liveFloor.leaveEarly')}
        </Button>
      ) : null}
    </Inline>
  );
}

/**
 * The chosen table (#77, #81): its rules and night so far, its seats and its recent hands. The floor
 * seats a player, moves one (the same session, so call time runs on) or lets one leave; admins let one
 * leave before call time, with a reason (#79); floor managers open or close the table and set it to
 * feed a main table.
 */
export function TableDetail({ venueId, table, tables, seats, held, permissions, night }: TableDetailProps) {
  const { leave, setLeaving } = useSeatActions(venueId);
  const [moving, setMoving] = useState<SeatedPlayer | null>(null);
  const [leavingEarly, setLeavingEarly] = useState<SeatedPlayer | null>(null);
  const [failure, setFailure] = useState<SeatFailure | null>(null);
  const isFloor = permissions.includes('waitlist.manage');
  const report = (outcome: { ok: true } | { ok: false; error: SeatFailure }) => setFailure(outcome.ok ? null : outcome.error);
  return (
    <Stack gap={4}>
      <TableHeader table={table} night={night} />
      {permissions.includes('floor.manage') ? <TableControls venueId={venueId} table={table} tables={tables} isEmpty={seats.length === 0} onResult={report} /> : null}
      {failure === null ? null : <ErrorMessage>{t(SEAT_FAILURE_COPY[failure])}</ErrorMessage>}
      {permissions.includes('members.read') ? null : <Text tone="muted">{t('console.liveFloor.noSeatMap')}</Text>}
      <Stack gap={2} divided>
        {permissions.includes('members.read') ? Array.from({ length: table.seats }, (_, index) => {
          const player = seats.find((seat) => seat.seat === index + 1);
          return (
            <Inline key={index} justify="between" align="center">
              <SeatLine number={index + 1} player={player} heldFor={held.find((seat) => seat.seat === index + 1)} isOpen={table.isOpen} />
              {isFloor && player !== undefined ? (
                <SeatButtons player={player} canLetGoEarly={permissions.includes('call_time.override')} onMove={() => setMoving(player)}
                  onLeave={() => void leave.mutateAsync(player.sessionId).then(report)} onLeaveEarly={() => setLeavingEarly(player)}
                  onLeaving={(isLeaving) => void setLeaving.mutateAsync({ sessionId: player.sessionId, isLeaving }).then(report)} />
              ) : null}
            </Inline>
          );
        }) : null}
      </Stack>
      {moving === null ? null : <MoveForm venueId={venueId} player={moving} tables={tables} onDone={(outcome) => { report(outcome); if (outcome.ok) setMoving(null); }} onCancel={() => setMoving(null)} />}
      {leavingEarly === null ? null : (
        <EarlyLeaveForm key={leavingEarly.sessionId} venueId={venueId} onDone={report} onCancel={() => setLeavingEarly(null)}
          member={{ memberId: leavingEarly.memberId, fullName: leavingEarly.fullName, owed: leavingEarly.callTimeLeft ?? 0 }} />
      )}
      {isFloor && table.isOpen ? <SeatForm venueId={venueId} table={table} seats={seats} held={held} onResult={report} /> : null}
      <RecentHands tableId={table.id} />
    </Stack>
  );
}
