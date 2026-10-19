import { useSeatActions, type FloorTable, type HeldSeat, type SeatedPlayer, type SeatFailure, type TableNight } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, CallTimeTimer, ErrorMessage, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
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
      {player.callTimeLeft === null ? null : <CallTimeTimer secondsLeft={player.callTimeLeft} isPaused={player.isAway} />}
    </Inline>
  );
}

/**
 * The chosen table (#77, #81): its rules and night so far, its seats and its recent hands. The floor
 * seats a player, moves one (the same session, so call time runs on) or lets one leave; floor
 * managers open or close the table and set it to feed a main table.
 */
export function TableDetail({ venueId, table, tables, seats, held, permissions, night }: TableDetailProps) {
  const { leave } = useSeatActions(venueId);
  const [moving, setMoving] = useState<SeatedPlayer | null>(null);
  const [failure, setFailure] = useState<SeatFailure | null>(null);
  const isFloor = permissions.includes('waitlist.manage');
  const report = (outcome: { ok: true } | { ok: false; error: SeatFailure }) => setFailure(outcome.ok ? null : outcome.error);
  const moveLabel = t('console.liveFloor.move');
  const leaveLabel = t('console.liveFloor.leave');
  return (
    <Stack gap={4}>
      <TableHeader table={table} night={night} />
      {permissions.includes('floor.manage') ? <TableControls venueId={venueId} table={table} tables={tables} isEmpty={seats.length === 0} onResult={report} /> : null}
      {failure === null ? null : <ErrorMessage>{t(SEAT_FAILURE_COPY[failure])}</ErrorMessage>}
      <Stack gap={2} divided>
        {Array.from({ length: table.seats }, (_, index) => {
          const player = seats.find((seat) => seat.seat === index + 1);
          return (
            <Inline key={index} justify="between" align="center">
              <SeatLine number={index + 1} player={player} heldFor={held.find((seat) => seat.seat === index + 1)} isOpen={table.isOpen} />
              {isFloor && player !== undefined ? (
                <Inline gap={2}>
                  <Button variant="text" aria-label={t('console.liveFloor.moveName', { name: player.fullName })} onClick={() => setMoving(player)}>{moveLabel}</Button>
                  <Button variant="text" aria-label={t('console.liveFloor.leaveName', { name: player.fullName })}
                    onClick={() => void leave.mutateAsync(player.sessionId).then(report)}>{leaveLabel}</Button>
                </Inline>
              ) : null}
            </Inline>
          );
        })}
      </Stack>
      {moving === null ? null : <MoveForm venueId={venueId} player={moving} tables={tables} onDone={(outcome) => { report(outcome); if (outcome.ok) setMoving(null); }} onCancel={() => setMoving(null)} />}
      {isFloor && table.isOpen ? <SeatForm venueId={venueId} table={table} seats={seats} held={held} onResult={report} /> : null}
      <RecentHands tableId={table.id} />
    </Stack>
  );
}
