import { useMySeatActions, type MySeat, type MySeatFailure } from '@rivr/db';
import { canSetCallTime } from '@rivr/domain/callTime';
import { formatDuration, formatTime, t } from '@rivr/i18n';
import { Button, ChoiceChips, ErrorMessage, Sheet, Stack, Text, useIsOnline, useToast } from '@rivr/ui';
import { useId, useState } from 'react';

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

/** The line under the lengths: when the chosen one ends, and, with any greyed out, the time none may end before (`id`, which the lengths name as their description). */
function CallTimeLine({ id, choice, secondsLeft, hasGreyed, now }: { id: string; choice: number | null; secondsLeft: number; hasGreyed: boolean; now: Date }) {
  const at = (seconds: number) => formatTime(new Date(now.getTime() + seconds * 1000));
  return (
    <Stack gap={1}>
      {choice === null ? null : <Text tone="muted">{t('player.live.seat.callTimeEnds', { time: at(choice * 60) })}</Text>}
      {hasGreyed ? <Text id={id} tone="muted">{t('player.live.seat.callTimeNotBefore', { time: at(secondsLeft) })}</Text> : null}
    </Stack>
  );
}

/**
 * "Set call time" (the owner, 17 Nov; #1059): every length the club offers (call_time.add_choices), counted from now; a
 * length that would end before the call time owed is greyed out, and the line under them, which they name as their
 * description, says why. Set, it is owed at once, with no floor approval; the seat then says until when. An hour is chosen
 * first where it is open. The times move with the clock (`now`) while the sheet is open.
 */
function SetCallTimeSheet({ seat, secondsLeft, now, onClose }: SheetProps & { seat: MySeat; secondsLeft: number; now: Date }) {
  const { setCallTime } = useMySeatActions();
  const toast = useToast();
  const send = useSend(onClose);
  const whyId = useId();
  const isOpen = (minutes: number) => canSetCallTime(minutes, secondsLeft);
  const choices = seat.addTimeChoices;
  const [choice, setChoice] = useState(choices.find((minutes) => minutes === 60 && isOpen(minutes)) ?? choices.find(isOpen) ?? null);
  const [requestId] = useState(() => crypto.randomUUID());
  const set = async (minutes: number) => {
    const outcome = await setCallTime.mutateAsync({ minutes, requestId });
    if (outcome.ok) toast(t('player.live.seat.callTimeSet'));
    send.settle(outcome);
  };
  return (
    <Sheet isOpen onClose={onClose} title={t('player.live.seat.setCallTime')}>
      <Stack gap={4}>
        <ChoiceChips label={t('player.live.seat.setCallTime')} isLabelVisuallyHidden look="tile" mode="one" selected={choice === null ? [] : [String(choice)]}
          describedBy={choices.every(isOpen) ? undefined : whyId}
          options={choices.map((minutes) => ({ value: String(minutes), label: formatDuration(minutes * 60), isDisabled: !isOpen(minutes) }))}
          onChange={([value]) => setChoice(choices.find((minutes) => String(minutes) === value) ?? choice)} />
        <CallTimeLine id={whyId} choice={choice} secondsLeft={secondsLeft} hasGreyed={!choices.every(isOpen)} now={now} />
        <Button variant="primary" size="tall" fullWidth isDisabled={send.isOffline || choice === null} isLoading={setCallTime.isPending}
          onClick={() => { if (choice !== null) void set(choice); }}>
          {t('player.live.seat.setCallTime')}
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
        {seat.hasCallTime ? <Text tone="muted">{t('player.live.seat.leaveLeft', { time: formatDuration(secondsLeft) })}</Text> : null}
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
  if (open === 'addTime') return <SetCallTimeSheet seat={seat} secondsLeft={secondsLeft} now={now} onClose={onClose} />;
  if (open === 'leave') return <LeaveSheet seat={seat} secondsLeft={secondsLeft} onClose={onClose} />;
  return null;
}
