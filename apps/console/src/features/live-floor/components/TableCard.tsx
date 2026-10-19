import type { FloorTable, HeldSeat, SeatedPlayer } from '@rivr/db';
import { formatStakes, t } from '@rivr/i18n';
import { Box, SeatRing, Stack, Text } from '@rivr/ui';

/** Initials as the seat ring shows them: Ishaan Verma is IV. */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return `${words[0]?.[0] ?? ''}${words.length > 1 ? words[words.length - 1]?.[0] ?? '' : ''}`.toUpperCase();
}

/** What a seat shows on the ring: who sits there, H when it is held for a waitlist call, or nothing when open. */
function markOf(number: number, seats: readonly SeatedPlayer[], held: readonly HeldSeat[]): string | null {
  const player = seats.find((seat) => seat.seat === number);
  if (player) return initialsOf(player.fullName);
  return held.some((seat) => seat.seat === number) ? t('console.liveFloor.heldMark') : null;
}

/** One table on the room plan, as in the prototype: its seat ring and how many sit there, or Closed. */
export function TableCard({ table, seats, held }: { table: FloorTable; seats: readonly SeatedPlayer[]; held: readonly HeldSeat[] }) {
  const ring = Array.from({ length: table.seats }, (_, index) => ({ number: index + 1, initials: markOf(index + 1, seats, held) }));
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
