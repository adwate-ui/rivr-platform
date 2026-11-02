import { useMySeatActions, type MySeat, type MySeatFailure } from '@rivr/db';
import { ADD_TIME_CHOICES, type AddTimeMinutes } from '@rivr/domain/callTime';
import { formatHoursMinutes, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Sheet, Stack, Text } from '@rivr/ui';
import { useState } from 'react';

/** The sheet open from the seat: a top-up, more time, or leaving. */
export type SeatSheet = 'topUp' | 'addTime' | 'leave';

interface SheetProps {
  onClose: () => void;
}

/** Sent, the sheet closes; refused, it says why in the sheet. */
function useSend(onClose: () => void) {
  const [failure, setFailure] = useState<MySeatFailure | null>(null);
  const settle = (outcome: { ok: true } | { ok: false; error: MySeatFailure }) => {
    setFailure(outcome.ok ? null : outcome.error);
    if (outcome.ok) onClose();
  };
  const notice = failure === null ? null : <ErrorMessage look="dot">{t(`player.tonight.seatFailures.${failure}`)}</ErrorMessage>;
  return { settle, notice };
}

/** "Top up": Request top-up or Cancel. No amount (#627). */
function TopUpSheet({ onClose }: SheetProps) {
  const { requestTopUp } = useMySeatActions();
  const send = useSend(onClose);
  return (
    <Sheet isOpen onClose={onClose} title={t('player.live.seat.topUp')}>
      <Stack gap={4}>
        <Button variant="primary" size="tall" fullWidth isLoading={requestTopUp.isPending}
          onClick={() => void requestTopUp.mutateAsync().then(send.settle)}>{t('player.live.seat.requestTopUp')}</Button>
        {send.notice}
        <Button variant="text" fullWidth onClick={onClose}>{t('player.live.seat.cancel')}</Button>
      </Stack>
    </Sheet>
  );
}

/** "Add time": 30 min, 1 hour or 2 hours (an hour unless changed), then Request it of the floor (decision 0320). */
function AddTimeSheet({ onClose }: SheetProps) {
  const { requestTime } = useMySeatActions();
  const send = useSend(onClose);
  const [choice, setChoice] = useState<AddTimeMinutes>(60);
  const [requestId] = useState(() => crypto.randomUUID());
  const label = (minutes: AddTimeMinutes) => t(`player.live.seat.times.m${minutes}`);
  return (
    <Sheet isOpen onClose={onClose} title={t('player.live.seat.addTime')}>
      <Stack gap={4}>
        <ChoiceChips label={t('player.live.seat.addTime')} isLabelVisuallyHidden look="tile" mode="one" selected={[String(choice)]}
          options={ADD_TIME_CHOICES.map((minutes) => ({ value: String(minutes), label: label(minutes) }))}
          onChange={([value]) => setChoice(ADD_TIME_CHOICES.find((minutes) => String(minutes) === value) ?? choice)} />
        <Button variant="primary" size="tall" fullWidth isLoading={requestTime.isPending}
          onClick={() => void requestTime.mutateAsync({ minutes: choice, requestId }).then(send.settle)}>
          {t('player.live.seat.requestTime', { choice: label(choice) })}
        </Button>
        {send.notice}
        <Button variant="text" fullWidth onClick={onClose}>{t('player.live.seat.cancel')}</Button>
      </Stack>
    </Sheet>
  );
}

/** "Leave your seat?": the call time left, then Join leaving list (or the seat opens, with none owed) or Stay seated. */
function LeaveSheet({ seat, secondsLeft, onClose }: SheetProps & { seat: MySeat; secondsLeft: number }) {
  const { leave } = useMySeatActions();
  const send = useSend(onClose);
  return (
    <Sheet isOpen onClose={onClose} title={t('player.live.seat.leaveTitle')}>
      <Stack gap={4}>
        {seat.hasCallTime ? <Text tone="muted">{t('player.live.seat.leaveLeft', { time: formatHoursMinutes(secondsLeft) })}</Text> : null}
        <Button variant="primary" size="tall" fullWidth isLoading={leave.isPending} onClick={() => void leave.mutateAsync().then(send.settle)}>
          {t('player.live.seat.joinLeaving')}
        </Button>
        {send.notice}
        <Button variant="text" fullWidth onClick={onClose}>{t('player.live.seat.stay')}</Button>
      </Stack>
    </Sheet>
  );
}

/** The seat's sheet that is open, if one is. */
export function SeatSheets({ open, seat, secondsLeft, onClose }: { open: SeatSheet | null; seat: MySeat; secondsLeft: number; onClose: () => void }) {
  if (open === 'topUp') return <TopUpSheet onClose={onClose} />;
  if (open === 'addTime') return <AddTimeSheet onClose={onClose} />;
  if (open === 'leave') return <LeaveSheet seat={seat} secondsLeft={secondsLeft} onClose={onClose} />;
  return null;
}
