import { useMyDevice, useTabletSeats, type TabletSeat } from '@rivr/db';
import { formatStakes, t } from '@rivr/i18n';
import { LoadState, SeatRing, Stack, Text, type RingSeat } from '@rivr/ui';
import { useState } from 'react';
import { SeatPanel } from './SeatPanel.tsx';
import { ringStatus } from './seatStatus.ts';

/** Initials as the ring shows them: Farhan Qureshi is FQ. */
function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return `${words[0]?.[0] ?? ''}${words.length > 1 ? words[words.length - 1]?.[0] ?? '' : ''}`.toUpperCase();
}

/** The table's stake for the felt, as the floor writes it: `100/200`. */
const stakesOf = (seats: readonly TabletSeat[]) => (seats[0] === undefined ? '' : formatStakes(seats[0].smallBlind, seats[0].bigBlind));

/** The seats as the ring draws them: who sits where, and what to watch (F-189). */
function ringSeats(seats: readonly TabletSeat[]): RingSeat[] {
  return seats.map(({ seat, player }) => ({
    number: seat, initials: player ? initialsOf(player.fullName) : null,
    ...(player ? { name: player.fullName, status: ringStatus(player) } : {}),
  }));
}

/** The seat tapped: its panel, or that it is open. */
function ChosenSeat({ seat, chosen, onLeft }: { seat: TabletSeat | undefined; chosen: number | null; onLeft: () => void }) {
  if (seat?.player) return <SeatPanel key={seat.player.sessionId} seat={seat} player={seat.player} onLeft={onLeft} />;
  return chosen === null ? null : <Text tone="muted">{t('tablet.seats.open', { seat: chosen })}</Text>;
}

/**
 * The table's seats on the tablet (#59), as in the prototype: the ring with who sits where and the seats to watch; the seat
 * tapped opens its buy-in request, Away and Player left. The seats come again every ten seconds.
 */
export function TableSeats() {
  const seats = useTabletSeats();
  const tableName = useMyDevice().data?.tableName ?? '';
  const [chosen, setChosen] = useState<number | null>(null);
  if (seats.data === undefined) return <LoadState isError={seats.isError} onRetry={() => void seats.refetch()} />;
  const seat = seats.data.find((candidate) => candidate.seat === chosen);
  return (
    <Stack gap={4}>
      <SeatRing name={tableName} stakes={stakesOf(seats.data)} seats={ringSeats(seats.data)} label={t('tablet.seats.ring', { table: tableName })} selectedSeat={chosen} onSelectSeat={setChosen} />
      <ChosenSeat seat={seat} chosen={chosen} onLeft={() => setChosen(null)} />
    </Stack>
  );
}
