import { useMyDevice, useTabletSeats } from '@rivr/db';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, SeatRing, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { SeatPanel } from './SeatPanel.tsx';

/** Initials as the ring shows them: Farhan Qureshi is FQ. */
function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  return `${words[0]?.[0] ?? ''}${words.length > 1 ? words[words.length - 1]?.[0] ?? '' : ''}`.toUpperCase();
}

/**
 * The table's seats on the tablet (#59), as in the prototype: the ring with who sits where; the seat
 * tapped opens its buy-in request, Away and Player left. The seats come again every ten seconds.
 */
export function TableSeats() {
  const seats = useTabletSeats();
  const tableName = useMyDevice().data?.tableName ?? '';
  const [chosen, setChosen] = useState<number | null>(null);
  if (seats.data === undefined && seats.isError) {
    return (
      <Stack gap={3} align="start">
        <ErrorMessage>{t('common.loadFailed')}</ErrorMessage>
        <Button onClick={() => void seats.refetch()}>{t('common.retry')}</Button>
      </Stack>
    );
  }
  if (seats.data === undefined) return <Text tone="muted">{t('common.loading')}</Text>;
  const ring = seats.data.map((seat) => ({
    number: seat.seat, initials: seat.player ? initialsOf(seat.player.fullName) : null, ...(seat.player ? { name: seat.player.fullName } : {}),
  }));
  const seat = seats.data.find((candidate) => candidate.seat === chosen);
  return (
    <Stack gap={4}>
      <SeatRing name={tableName} stakes="" seats={ring} label={t('tablet.seats.ring', { table: tableName })} selectedSeat={chosen} onSelectSeat={setChosen} />
      {seat?.player ? <SeatPanel key={seat.player.sessionId} seat={seat} player={seat.player} onLeft={() => setChosen(null)} />
        : chosen === null ? null : <Text tone="muted">{t('tablet.seats.open', { seat: chosen })}</Text>}
    </Stack>
  );
}
