import type { FloorNight, FloorTable, HeldSeat, SeatedPlayer } from '@rivr/db';
import { formatStakes, t } from '@rivr/i18n';
import { Box, Grid, Inline, Stack, TableCard, Text } from '@rivr/ui';
import { ringOf } from './ringOf.ts';

interface RoomPlanProps {
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  /** Whether the staff member reads members, and so sees who sits where (#333). */
  canSeeSeats: boolean;
  held: readonly HeldSeat[];
  night: FloorNight;
  chosenId: string;
  onChoose: (tableId: string) => void;
}

/** A card's ring label and occupancy line: closed, open with how many sit there, or just open for a role without the seat map. */
function cardWords(table: FloorTable, taken: number, canSeeSeats: boolean): { ringLabel: string; occupancy: string } {
  if (!table.isOpen) return { ringLabel: t('console.liveFloor.ringClosed', { name: table.name }), occupancy: t('console.liveFloor.closed') };
  if (!canSeeSeats) return { ringLabel: t('console.liveFloor.ringOpen', { name: table.name }), occupancy: t('console.liveFloor.tableOpen') };
  return {
    ringLabel: t('console.liveFloor.ringLabel', { name: table.name, taken, seats: table.seats }),
    occupancy: t('console.liveFloor.seatsTaken', { taken, seats: table.seats }),
  };
}

/** One table's card: its ring, how many sit there, its dealer and hands in the last hour; no rake, as no console shows it (#626). */
function Card({ table, seats, held, night, canSeeSeats, isChosen, onChoose }: Omit<RoomPlanProps, 'tables' | 'chosenId' | 'onChoose'> & { table: FloorTable; isChosen: boolean; onChoose: () => void }) {
  const here = seats.filter((seat) => seat.tableId === table.id);
  const figures = night.tables.find((candidate) => candidate.tableId === table.id);
  const { ringLabel, occupancy } = cardWords(table, here.length, canSeeSeats);
  return (
    <TableCard name={table.name} stakes={formatStakes(table.smallBlind, table.bigBlind)} isClosed={!table.isOpen} ringLabel={ringLabel}
      seats={canSeeSeats ? ringOf(table, here, held.filter((seat) => seat.tableId === table.id)) : []}
      occupancy={occupancy}
      rake={null} dealer={figures?.dealerName ?? t('console.liveFloor.noDealer')}
      pace={figures && figures.handsLastHour > 0 ? t('console.liveFloor.handsPerHour', { count: figures.handsLastHour }) : t('console.liveFloor.noPace')}
      isSelected={isChosen} onSelect={onChoose} />
  );
}

/**
 * The room plan, as in the prototype (#81) but with no rake (#626): how many are seated, then the main room's
 * tables and the Private Room's, each a card that opens the table beside.
 */
export function RoomPlan({ tables, seats, held, night, canSeeSeats, chosenId, onChoose }: RoomPlanProps) {
  const rooms = [
    { key: 'main', label: t('console.liveFloor.mainRoom'), tables: tables.filter((table) => table.room === 'main') },
    { key: 'private', label: t('console.liveFloor.privateRoom'), tables: tables.filter((table) => table.room === 'private') },
  ].filter((room) => room.tables.length > 0);
  return (
    <Stack gap={4} as="section" aria-label={t('console.liveFloor.roomPlan')}>
      <Inline gap={6} align="baseline">
        <Text tone="muted">{canSeeSeats ? t('console.liveFloor.seatedCount', { count: seats.length }) : t('console.liveFloor.noSeatMap')}</Text>
      </Inline>
      {rooms.map((room) => (
        <Box key={room.key} padding={4} radius="md" hairline="all">
          <Stack gap={3}>
            <Text variant="small" tone="muted">{room.label}</Text>
            <Grid columns={2} gap={4}>
              {room.tables.map((table) => (
                <Card key={table.id} table={table} seats={seats} held={held} night={night} canSeeSeats={canSeeSeats} isChosen={table.id === chosenId}
                  onChoose={() => onChoose(table.id)} />
              ))}
            </Grid>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
