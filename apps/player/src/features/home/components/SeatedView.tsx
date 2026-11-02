import { useFeature, type MySeat } from '@rivr/db';
import { callTimeFraction, isCallTimeEnding, secondsUntil } from '@rivr/domain/callTime';
import { formatClock, formatHoursMinutes, formatTime, t } from '@rivr/i18n';
import { FeatureGate, Figure, Inline, ProgressRing, Text } from '@rivr/ui';
import { OrderTracker } from './OrderTracker.tsx';
import { OrderToSeat, SeatActions, SeatStatus } from './SeatActions.tsx';
import { SeatSheets, type SeatSheet } from './SeatSheets.tsx';

/** The call time left now: counted down from the server's end of it, or as it stands while the member is away. */
export function callSecondsLeft(seat: MySeat, now: Date): number {
  if (seat.callTimeEndsAt !== null) return secondsUntil(new Date(seat.callTimeEndsAt), now);
  return seat.callTimeLeft ?? 0;
}

/**
 * The call-time ring (brief 3.4 E): gold for what is left on its faint track, moving on each second, red in the last 15
 * minutes; in the middle the time left as h:mm:ss and when it ends. It stands still while the member is away.
 */
function CallTimeRing({ seat, now }: { seat: MySeat; now: Date }) {
  const left = callSecondsLeft(seat, now);
  const endsAt = new Date(now.getTime() + left * 1000);
  return (
    <ProgressRing fraction={callTimeFraction(left, seat.callTimeMinutes ?? 0)} tone={isCallTimeEnding(left) ? 'alert' : 'gold'}>
      <Figure size="timer" role="timer" aria-label={t('player.live.seated.timer', { time: formatHoursMinutes(left) })}>{formatClock(left)}</Figure>
      <Text variant="small" tone="muted">{t('player.live.seated.left', { time: formatTime(endsAt) })}</Text>
    </ProgressRing>
  );
}

interface SeatedViewProps {
  seat: MySeat;
  now: Date;
  /** The seat's sheet that is open, which the call-time banner opens too. */
  sheet: SeatSheet | null;
  onSheet: (sheet: SeatSheet | null) => void;
}

/**
 * Seated (brief 3.4 E): the call-time ring with call_time.view, where the seat has call time; the three round actions and
 * their sheets; Order to my seat; tonight's order on its way; and the seat's open requests.
 */
export function SeatedView({ seat, now, sheet, onSheet }: SeatedViewProps) {
  const callTime = useFeature('call_time.view');
  return (
    <>
      {seat.hasCallTime ? (
        <Inline justify="center">
          <FeatureGate access={callTime}><CallTimeRing seat={seat} now={now} /></FeatureGate>
        </Inline>
      ) : null}
      <SeatActions seat={seat} onOpen={onSheet} />
      <OrderToSeat />
      <OrderTracker />
      <SeatStatus seat={seat} />
      <SeatSheets open={sheet} seat={seat} secondsLeft={callSecondsLeft(seat, now)} onClose={() => onSheet(null)} />
    </>
  );
}
