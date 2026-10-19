import { useSeatActions, type FloorTable, type SeatedPlayer, type SeatFailure } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { MoveForm } from './MoveForm.tsx';
import { SEAT_FAILURE_COPY } from './seatCopy.ts';
import { SeatForm } from './SeatForm.tsx';
import { TableControls } from './TableControls.tsx';

interface TableDetailProps {
  venueId: string;
  table: FloorTable;
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  permissions: readonly string[];
  stakes: string;
}

/** One seat's row, as in the prototype: who sits there and their tier, their must-move turn, or Open. */
function SeatLine({ number, player }: { number: number; player: SeatedPlayer | undefined }) {
  if (player === undefined) {
    return <Inline gap={4}><Text tone="muted">{number}</Text><Text tone="muted">{t('console.liveFloor.seatOpen')}</Text></Inline>;
  }
  return (
    <Inline gap={4} align="center">
      <Text tone="muted">{number}</Text>
      <Text>{player.fullName}</Text>
      <Text tone="muted">{player.tierName}</Text>
      {player.mustMoveOrder === null ? null : <Text variant="small" tone="muted">{t('console.liveFloor.mustMove', { order: player.mustMoveOrder })}</Text>}
    </Inline>
  );
}

/**
 * The chosen table's seats (#77): the floor seats a player, moves one (the same session, so call
 * time runs on) or lets one leave; floor managers open or close the table and set it to feed a main table.
 */
export function TableDetail({ venueId, table, tables, seats, permissions, stakes }: TableDetailProps) {
  const { leave } = useSeatActions(venueId);
  const [moving, setMoving] = useState<SeatedPlayer | null>(null);
  const [failure, setFailure] = useState<SeatFailure | null>(null);
  const isFloor = permissions.includes('waitlist.manage');
  const report = (outcome: { ok: true } | { ok: false; error: SeatFailure }) => setFailure(outcome.ok ? null : outcome.error);
  const moveLabel = t('console.liveFloor.move');
  const leaveLabel = t('console.liveFloor.leave');
  return (
    <Stack gap={4}>
      <Stack gap={1}><Heading level={2}>{table.name}</Heading><Text tone="muted">{stakes}</Text></Stack>
      {permissions.includes('floor.manage') ? <TableControls venueId={venueId} table={table} tables={tables} isEmpty={seats.length === 0} onResult={report} /> : null}
      {failure === null ? null : <ErrorMessage>{t(SEAT_FAILURE_COPY[failure])}</ErrorMessage>}
      <Stack gap={2} divided>
        {Array.from({ length: table.seats }, (_, index) => {
          const player = seats.find((seat) => seat.seat === index + 1);
          return (
            <Inline key={index} justify="between" align="center">
              <SeatLine number={index + 1} player={player} />
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
      {isFloor && table.isOpen ? <SeatForm venueId={venueId} table={table} seats={seats} onResult={report} /> : null}
    </Stack>
  );
}
