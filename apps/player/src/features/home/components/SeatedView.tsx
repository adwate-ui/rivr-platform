import { useFeature, type MySeat, type WaitlistPlace } from '@rivr/db';
import { secondsUntil } from '@rivr/domain/callTime';
import { formatTime, t } from '@rivr/i18n';
import { Figure, Stack, Text } from '@rivr/ui';
import { NextBonusChips } from './NextBonusChips.tsx';
import { OrderTracker } from './OrderTracker.tsx';
import { OrderToSeat, SeatActions, SeatStatus } from './SeatActions.tsx';
import { SeatSheets, type SeatSheet } from './SeatSheets.tsx';

/** The call time left now: counted down from the server's end of it, or as it stands while the member is away. */
export function callSecondsLeft(seat: MySeat, now: Date): number {
  if (seat.callTimeEndsAt !== null) return secondsUntil(new Date(seat.callTimeEndsAt), now);
  return seat.callTimeLeft ?? 0;
}

/**
 * Where the call-time ring was (the owner, 17 Nov): when the member sat down, with no countdown; and once they have set
 * their call time themselves (#1059), when it ends, while they are at the table (it stands still while they are away).
 */
function PlayingSince({ seat }: { seat: MySeat }) {
  const callTime = useFeature('call_time.view');
  const until = callTime.state === 'enabled' && seat.callTimeSetAt !== null ? seat.callTimeEndsAt : null;
  return (
    <Stack gap={1} align="center">
      <Text variant="small" tone="muted">{t('player.live.seated.playingSince')}</Text>
      <Figure size="timer">{formatTime(new Date(seat.startedAt))}</Figure>
      {until === null ? null : <Text variant="small" tone="muted">{t('player.live.seated.callTimeUntil', { time: formatTime(new Date(until)) })}</Text>}
    </Stack>
  );
}

interface SeatedViewProps {
  seat: MySeat;
  /** A place on another list to change tables (#781), which the floor added. */
  places: readonly WaitlistPlace[];
  now: Date;
  /** The seat's sheet that is open, which the call-time banner opens too. */
  sheet: SeatSheet | null;
  onSheet: (sheet: SeatSheet | null) => void;
}

/**
 * Seated (brief 3.4 E): when the member sat down, and the call time they set; the three round actions and their sheets;
 * the next play-time bonus; Order to my seat; tonight's order on its way; and the seat's open requests, any place on a
 * list among them.
 */
export function SeatedView({ seat, places, now, sheet, onSheet }: SeatedViewProps) {
  return (
    <>
      <PlayingSince seat={seat} />
      <SeatActions seat={seat} onOpen={onSheet} />
      <NextBonusChips />
      <OrderToSeat />
      <OrderTracker />
      <SeatStatus seat={seat} places={places} />
      <SeatSheets open={sheet} seat={seat} secondsLeft={callSecondsLeft(seat, now)} now={now} onClose={() => onSheet(null)} />
    </>
  );
}
