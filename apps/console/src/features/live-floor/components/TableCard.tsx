import type { FloorTable, SeatedPlayer } from '@rivr/db';
import { formatStakes, t } from '@rivr/i18n';
import { Box, SeatRing, Stack, Text } from '@rivr/ui';

/** Initials as the seat ring shows them: Ishaan Verma is IV. */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return `${words[0]?.[0] ?? ''}${words.length > 1 ? words[words.length - 1]?.[0] ?? '' : ''}`.toUpperCase();
}

/** One table on the room plan, as in the prototype: its seat ring and how many sit there, or Closed. */
export function TableCard({ table, seats }: { table: FloorTable; seats: readonly SeatedPlayer[] }) {
  const ring = Array.from({ length: table.seats }, (_, index) => {
    const player = seats.find((seat) => seat.seat === index + 1);
    return { number: index + 1, initials: player ? initialsOf(player.fullName) : null };
  });
  const taken = t('console.liveFloor.seatsTaken', { taken: seats.length, seats: table.seats });
  const label = table.isOpen ? t('console.liveFloor.ringLabel', { name: table.name, taken: seats.length, seats: table.seats })
    : t('console.liveFloor.ringClosed', { name: table.name });
  return (
    <Box surface="raised" padding={4} radius="md" hairline="all">
      <Stack gap={2}>
        <SeatRing name={table.name} stakes={formatStakes(table.smallBlind, table.bigBlind)} seats={ring} label={label} isClosed={!table.isOpen} />
        <Text variant="small" tone="muted">{table.isOpen ? taken : t('console.liveFloor.closed')}</Text>
      </Stack>
    </Box>
  );
}
