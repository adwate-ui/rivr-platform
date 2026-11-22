import { useMySeatActions, type MySeat, type MySeatFailure } from '@rivr/db';
import { clockTimeAfter, nearestClockMoment } from '@rivr/domain/clubDay';
import { formatDuration, formatTime, t } from '@rivr/i18n';
import { Button, ErrorMessage, Input, Sheet, Stack, Text, useIsOnline, useToast } from '@rivr/ui';
import { useRef, useState } from 'react';

/** The sheet open from the seat: a top-up, setting the call time (`addTime`, as a push's link names it), or leaving. */
export type SeatSheet = 'topUp' | 'addTime' | 'leave';

interface SheetProps {
  onClose: () => void;
}

/**
 * Sent, the sheet closes; refused, it says why in the sheet. Offline nothing is sent: the seat may be one the phone only
 * remembers, and a request held for the connection would act on whatever seat the member has by then.
 */
function useSend(onClose: () => void) {
  const isOnline = useIsOnline();
  const [failure, setFailure] = useState<MySeatFailure | null>(null);
  const settle = (outcome: { ok: true } | { ok: false; error: MySeatFailure }) => {
    setFailure(outcome.ok ? null : outcome.error);
    if (outcome.ok) onClose();
  };
  const notice = failure === null ? null : <ErrorMessage look="dot">{t(`player.tonight.seatFailures.${failure}`)}</ErrorMessage>;
  return { settle, notice, isOffline: !isOnline };
}

/** "Top up": Request top-up or Cancel. No amount (#627). */
function TopUpSheet({ onClose }: SheetProps) {
  const { requestTopUp } = useMySeatActions();
  const send = useSend(onClose);
  return (
    <Sheet isOpen onClose={onClose} title={t('player.live.seat.topUp')}>
      <Stack gap={4}>
        <Button variant="primary" size="tall" fullWidth isDisabled={send.isOffline} isLoading={requestTopUp.isPending}
          onClick={() => void requestTopUp.mutateAsync().then(send.settle)}>{t('player.live.seat.requestTopUp')}</Button>
        {send.notice}
        <Button variant="text" fullWidth onClick={onClose}>{t('player.live.seat.cancel')}</Button>
      </Stack>
    </Sheet>
  );
}

/** The time picked as a moment, the one the clock shows nearest now, or why it is refused: none picked, or not after `after`. */
function pickedUntil(time: string, now: Date, after: Date): { until: Date } | { error: string } {
  const until = nearestClockMoment(time, now);
  if (until === null) return { error: t('player.live.seat.pickTime') };
  return until > after ? { until } : { error: t('player.live.seat.pickAfter', { time: formatTime(after) }) };
}

/**
 * "Set call time" (the owner, 17 Nov; #1059), then "Extend call time" (18 Nov; #1076), to a time on the clock (22 Nov): the
 * phone's own picker, the time it must be later than under it (the minimum playing time's end until set, the current end
 * once set) and Extend's note (#1089). The time is the one the clock shows nearest now: 01:30 picked at 23:50 is tonight's,
 * and 22:00 picked at 22:44 has gone by. Owed at once, with no floor approval; the seat then says until when, and the floor
 * is told. Each time picked has its own request id, so a retry after a lost answer sets it once.
 */
function SetCallTimeSheet({ seat, now, onClose }: SheetProps & { seat: MySeat; now: Date }) {
  const { setCallTime } = useMySeatActions();
  const toast = useToast();
  const send = useSend(onClose);
  const isSet = seat.callTimeSetAt !== null;
  const action = t(isSet ? 'player.live.seat.extendCallTime' : 'player.live.seat.setCallTime');
  const after = seat.callTimeAfterAt === null ? now : new Date(seat.callTimeAfterAt);
  const [time, setTime] = useState(() => clockTimeAfter(after, 5));
  const [error, setError] = useState<string | null>(null);
  const requestIds = useRef(new Map<string, string>());
  const set = async () => {
    const picked = pickedUntil(time, now, after);
    if ('error' in picked) return setError(picked.error);
    const key = picked.until.toISOString();
    const requestId = requestIds.current.get(key) ?? crypto.randomUUID();
    requestIds.current.set(key, requestId);
    const outcome = await setCallTime.mutateAsync({ until: picked.until, requestId });
    if (outcome.ok) toast(t(isSet ? 'player.live.seat.callTimeExtended' : 'player.live.seat.callTimeSet'));
    send.settle(outcome);
  };
  return (
    <Sheet isOpen onClose={onClose} title={action}>
      <Stack gap={4}>
        <Input variant="inset" type="time" label={t('player.live.seat.until')} value={time} error={error ?? undefined}
          hint={t('player.live.seat.callTimeAfter', { time: formatTime(after) })} onChange={(event) => { setTime(event.target.value); setError(null); }} />
        {isSet ? <Text variant="caption" tone="muted">{t('player.live.seat.extendNote')}</Text> : null}
        <Button variant="primary" size="tall" fullWidth isDisabled={send.isOffline} isLoading={setCallTime.isPending} onClick={() => void set()}>
          {action}
        </Button>
        {send.notice}
        <Button variant="text" fullWidth onClick={onClose}>{t('player.live.seat.cancel')}</Button>
      </Stack>
    </Sheet>
  );
}

/** What leaving owes, in words: the call time left, or that none was set once the countdown is done (#1076). */
const leaveWords = (seat: MySeat, secondsLeft: number) => (seat.callTimeSetAt === null && secondsLeft <= 0
  ? t('player.live.seat.leaveNotSet') : t('player.live.seat.leaveLeft', { time: formatDuration(secondsLeft) }));

/**
 * "Leave your seat?": the call time left (only for a member who sees their call time: call_time.view), then Join leaving
 * list (or the seat opens, with none owed) or Stay seated.
 */
function LeaveSheet({ seat, secondsLeft, onClose }: SheetProps & { seat: MySeat; secondsLeft: number }) {
  const { leave } = useMySeatActions();
  const send = useSend(onClose);
  return (
    <Sheet isOpen onClose={onClose} title={t('player.live.seat.leaveTitle')}>
      <Stack gap={4}>
        {seat.hasCallTime && seat.callTimeLeft !== null ? <Text tone="muted">{leaveWords(seat, secondsLeft)}</Text> : null}
        <Button variant="primary" size="tall" fullWidth isDisabled={send.isOffline} isLoading={leave.isPending} onClick={() => void leave.mutateAsync().then(send.settle)}>
          {t('player.live.seat.joinLeaving')}
        </Button>
        {send.notice}
        <Button variant="text" fullWidth onClick={onClose}>{t('player.live.seat.stay')}</Button>
      </Stack>
    </Sheet>
  );
}

/** The seat's sheet that is open, if one is. */
export function SeatSheets({ open, seat, secondsLeft, now = new Date(), onClose }: {
  open: SeatSheet | null; seat: MySeat; secondsLeft: number; now?: Date; onClose: () => void;
}) {
  if (open === 'topUp') return <TopUpSheet onClose={onClose} />;
  if (open === 'addTime') return <SetCallTimeSheet seat={seat} now={now} onClose={onClose} />;
  if (open === 'leave') return <LeaveSheet seat={seat} secondsLeft={secondsLeft} onClose={onClose} />;
  return null;
}
