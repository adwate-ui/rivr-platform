import type { FloorNight, FloorTable, HeldSeat, SeatedPlayer } from '@rivr/db';
import { formatStakes, t } from '@rivr/i18n';
import { Box, Grid, Inline, Money, Stack, TableCard, Text } from '@rivr/ui';
import { ringOf } from './ringOf.ts';

interface RoomPlanProps {
  tables: readonly FloorTable[];
  seats: readonly SeatedPlayer[];
  held: readonly HeldSeat[];
  night: FloorNight;
  chosenId: string;
  onChoose: (tableId: string) => void;
}

/** One table's card: its ring, how many sit there and its rake tonight, its dealer and hands in the last hour. */
function Card({ table, seats, held, night, isChosen, onChoose }: Omit<RoomPlanProps, 'tables' | 'chosenId' | 'onChoose'> & { table: FloorTable; isChosen: boolean; onChoose: () => void }) {
  const here = seats.filter((seat) => seat.tableId === table.id);
  const figures = night.tables.find((candidate) => candidate.tableId === table.id);
  const ringLabel = table.isOpen ? t('console.liveFloor.ringLabel', { name: table.name, taken: here.length, seats: table.seats })
    : t('console.liveFloor.ringClosed', { name: table.name });
  return (
    <TableCard name={table.name} stakes={formatStakes(table.smallBlind, table.bigBlind)} isClosed={!table.isOpen} ringLabel={ringLabel}
      seats={ringOf(table, here, held.filter((seat) => seat.tableId === table.id))}
      occupancy={table.isOpen ? t('console.liveFloor.seatsTaken', { taken: here.length, seats: table.seats }) : t('console.liveFloor.closed')}
      rake={figures?.rake ?? null} dealer={figures?.dealerName ?? t('console.liveFloor.noDealer')}
      pace={figures && figures.handsLastHour > 0 ? t('console.liveFloor.handsPerHour', { count: figures.handsLastHour }) : t('console.liveFloor.noPace')}
      isSelected={isChosen} onSelect={onChoose} />
  );
}

/**
 * The room plan, as in the prototype (#81): rake tonight and how many are seated, then the main room's
 * tables and the Private Room's, each a card that opens the table beside.
 */
export function RoomPlan({ tables, seats, held, night, chosenId, onChoose }: RoomPlanProps) {
  const rooms = [
    { key: 'main', label: t('console.liveFloor.mainRoom'), tables: tables.filter((table) => table.room === 'main') },
    { key: 'private', label: t('console.liveFloor.privateRoom'), tables: tables.filter((table) => table.room === 'private') },
  ].filter((room) => room.tables.length > 0);
  return (
    <Stack gap={4} as="section" aria-label={t('console.liveFloor.roomPlan')}>
      <Inline gap={6} align="baseline">
        {night.rake === null ? null : <Inline gap={2} align="baseline"><Text tone="muted">{t('console.liveFloor.rakeTonight')}</Text><Money paise={night.rake} size="lead" /></Inline>}
        <Text tone="muted">{t('console.liveFloor.seatedCount', { count: seats.length })}</Text>
      </Inline>
      {rooms.map((room) => (
        <Box key={room.key} padding={4} radius="md" hairline="all">
          <Stack gap={3}>
            <Text variant="small" tone="muted">{room.label}</Text>
            <Grid columns={2} gap={4}>
              {room.tables.map((table) => (
                <Card key={table.id} table={table} seats={seats} held={held} night={night} isChosen={table.id === chosenId} onChoose={() => onChoose(table.id)} />
              ))}
            </Grid>
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}
