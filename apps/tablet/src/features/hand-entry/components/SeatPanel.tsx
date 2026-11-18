import { LEAVE_REASONS, type LeaveReason } from '@rivr/contracts';
import { useFnbOff, useMyDevice, useSeatEvents, type SeatEventFailure, type TabletPlayer, type TabletSeat } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, CallTimeTimer, ChoiceChips, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { SeatFnbOrder } from './SeatFnbOrder.tsx';

const FAILURE_COPY: Readonly<Record<SeatEventFailure, MessageKey>> = {
  not_allowed: 'tablet.seats.notAllowed',
  invalid: 'tablet.seats.invalid',
  paused: 'tablet.seats.paused',
  unavailable: 'tablet.seats.unavailable',
};

interface SeatPanelProps {
  seat: TabletSeat;
  player: TabletPlayer;
  onLeft: () => void;
}

/** Food and drink for the seat, or, while a super admin has it off (decision 0681), that it is off. */
function FnbForSeat({ onOpen }: { onOpen: () => void }) {
  const isFnbOff = useFnbOff(useMyDevice().data?.venueId ?? null);
  if (isFnbOff) return <Text tone="muted">{t('tablet.fnb.off')}</Text>;
  return <Button variant="text" onClick={onOpen}>{t('tablet.fnb.open')}</Button>;
}

type Report = (done: { ok: true } | { ok: false; error: SeatEventFailure }) => void;

/**
 * Why the player left (#1060, the owner, 17 Nov), on its own row under the seat's buttons: Call time met, picked already
 * when nothing is owed, or Busted, Emergency, Unwell, Table broke or Floor decision; then Yes, they left, or Cancel. With none
 * picked, Yes says to pick one, as the console's leave sheet does.
 */
function LeaveReasons({ player, report, onLeft, onCancel }: { player: TabletPlayer; report: Report; onLeft: () => void; onCancel: () => void }) {
  const { leave } = useSeatEvents();
  const [picked, setPicked] = useState<LeaveReason | null>(null);
  const [isMissing, setMissing] = useState(false);
  // Call time met only when nothing is owed (#1076): one never set is owed even at nought.
  const reason = picked ?? (player.owesCallTime ? null : 'call_time_met');
  const confirm = () => {
    if (reason === null) return setMissing(true);
    return void leave.mutateAsync({ sessionId: player.sessionId, reason }).then((done) => { report(done); if (done.ok) onLeft(); });
  };
  return (
    <Stack gap={2}>
      <ChoiceChips look="pill" mode="one" label={t('tablet.seats.why')} selected={reason === null ? [] : [reason]}
        options={LEAVE_REASONS.map((code) => ({ value: code, label: t(`common.leaveReasons.${code}`) }))}
        onChange={([value]) => { setPicked(LEAVE_REASONS.find((code) => code === value) ?? null); setMissing(false); }} />
      {isMissing ? <ErrorMessage>{t('tablet.seats.pickWhy')}</ErrorMessage> : null}
      <Inline gap={2}>
        <Button variant="text" onClick={onCancel}>{t('tablet.seats.cancel')}</Button>
        <Button variant="danger" isDisabled={leave.isPending} onClick={confirm}>{t('tablet.seats.confirmLeft', { name: player.fullName })}</Button>
      </Inline>
    </Stack>
  );
}

/**
 * The chosen seat, as in the prototype: who sits there and their call time; Away or Back; Player left, with why; and food
 * for the seat. No buy-in: the tablet shows no money (owner, 29 Oct, #630).
 */
export function SeatPanel({ seat, player, onLeft }: SeatPanelProps) {
  const { setAway } = useSeatEvents();
  const [failure, setFailure] = useState<SeatEventFailure | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const [isLeaving, setLeaving] = useState(false);
  const report: Report = (done) => setFailure(done.ok ? null : done.error);
  const awayLabel = player.isAway ? t('tablet.seats.back') : t('tablet.seats.away');
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('tablet.seats.title', { seat: seat.seat, name: player.fullName })}</Heading>
      {player.isAway ? <Text tone="muted">{t('tablet.seats.isAway')}</Text> : null}
      {player.callTimeLeft === null ? null : <CallTimeTimer secondsLeft={player.callTimeLeft} isPaused={player.isAway} />}
      <Inline gap={4}>
        <Button variant="text" isDisabled={setAway.isPending} onClick={() => void setAway.mutateAsync({ sessionId: player.sessionId, isAway: !player.isAway }).then(report)}>{awayLabel}</Button>
        {isLeaving ? null : <Button variant="text" onClick={() => setLeaving(true)}>{t('tablet.seats.left')}</Button>}
        <FnbForSeat onOpen={() => setIsOrdering(true)} />
      </Inline>
      {isLeaving ? <LeaveReasons player={player} report={report} onLeft={onLeft} onCancel={() => setLeaving(false)} /> : null}
      {isOrdering ? <SeatFnbOrder seat={seat.seat} onClose={() => setIsOrdering(false)} /> : null}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
