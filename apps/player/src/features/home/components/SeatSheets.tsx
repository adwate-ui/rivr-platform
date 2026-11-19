import { useMySeatActions, type MySeat, type MySeatFailure } from '@rivr/db';
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

/**
 * The line under the lengths: when the chosen one ends (from now until set, from the call time's end once set, #1076), and,
 * with any greyed out, the time none may end before (`id`, which the lengths name as their description).
 */
function CallTimeLine({ id, choice, from, secondsLeft, hasGreyed, now }: { id: string; choice: number | null; from: Date | null; secondsLeft: number; hasGreyed: boolean; now: Date }) {
  const at = (seconds: number) => formatTime(new Date(now.getTime() + seconds * 1000));
  return (
    <Stack gap={1}>
      {choice === null || from === null ? null : <Text tone="muted">{t('player.live.seat.callTimeEnds', { time: formatTime(new Date(from.getTime() + choice * 60_000)) })}</Text>}
      {hasGreyed ? <Text id={id} tone="muted">{t('player.live.seat.callTimeNotBefore', { time: at(secondsLeft) })}</Text> : null}
    </Stack>
  );
}

/** Where a length counts from (#1076): now until a call time is set; once set, the end of it while it runs, else now. */
function choiceFrom(seat: MySeat, now: Date): Date | null {
  if (seat.callTimeSetAt === null) return now;
  if (seat.callTimeEndsAt === null) return null;
  const end = new Date(seat.callTimeEndsAt);
  return end > now ? end : now;
}

/**
 * "Set call time" (the owner, 17 Nov; #1059), then "Extend call time" (18 Nov; #1076): every length the club offers
 * (call_time.add_choices to set; call_time.extend_choices to extend, beyond the current end, #1089). Until set, a length counts from now, and one ending no later than the call time the seat
 * started with is greyed out, the line under them (which they name as their description) saying why; once set, a length
 * extends it. Owed at once, with no floor approval; the seat then says until when, and the floor is told. An hour is
 * chosen first where it is open. The times move with the clock (`now`) while the sheet is open.
 */
function SetCallTimeSheet({ seat, secondsLeft, now, onClose }: SheetProps & { seat: MySeat; secondsLeft: number; now: Date }) {
  const { setCallTime } = useMySeatActions();
  const toast = useToast();
  const send = useSend(onClose);
  const whyId = useId();
  const isSet = seat.callTimeSetAt !== null;
  const isOpen = (minutes: number) => seat.callTimeChoicesOpen.includes(minutes);
  const choices = seat.addTimeChoices;
  // Set or Extend in words; lengths greyed only while setting (once set, Extend adds beyond the end, #1089).
  const action = t(isSet ? 'player.live.seat.extendCallTime' : 'player.live.seat.setCallTime');
  const hasGreyed = !isSet && !choices.every(isOpen);
  const [choice, setChoice] = useState(choices.find((minutes) => minutes === 60 && isOpen(minutes)) ?? choices.find(isOpen) ?? null);
  const [requestId] = useState(() => crypto.randomUUID());
  const set = async (minutes: number) => {
    const outcome = await setCallTime.mutateAsync({ minutes, requestId });
    if (outcome.ok) toast(t(isSet ? 'player.live.seat.callTimeExtended' : 'player.live.seat.callTimeSet'));
    send.settle(outcome);
  };
  return (
    <Sheet isOpen onClose={onClose} title={action}>
      <Stack gap={4}>
        <ChoiceChips label={action} isLabelVisuallyHidden look="tile" mode="one" selected={choice === null ? [] : [String(choice)]}
          describedBy={hasGreyed ? whyId : undefined}
          options={choices.map((minutes) => ({ value: String(minutes), label: formatDuration(minutes * 60), isDisabled: !isOpen(minutes) }))}
          onChange={([value]) => setChoice(choices.find((minutes) => String(minutes) === value) ?? choice)} />
        <CallTimeLine id={whyId} choice={choice} from={choiceFrom(seat, now)} secondsLeft={secondsLeft} hasGreyed={hasGreyed} now={now} />
        {isSet ? <Text variant="caption" tone="muted">{t('player.live.seat.extendNote')}</Text> : null}
        <Button variant="primary" size="tall" fullWidth isDisabled={send.isOffline || choice === null} isLoading={setCallTime.isPending}
          onClick={() => { if (choice !== null) void set(choice); }}>
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
  if (open === 'addTime') return <SetCallTimeSheet seat={seat} secondsLeft={secondsLeft} now={now} onClose={onClose} />;
  if (open === 'leave') return <LeaveSheet seat={seat} secondsLeft={secondsLeft} onClose={onClose} />;
  return null;
}
