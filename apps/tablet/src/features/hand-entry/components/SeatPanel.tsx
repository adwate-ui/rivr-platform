import { useSeatEvents, type SeatEventFailure, type TabletPlayer, type TabletSeat } from '@rivr/db';
import { t, type MessageKey } from '@rivr/i18n';
import { Button, CallTimeTimer, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState } from 'react';
import { SeatFnbOrder } from './SeatFnbOrder.tsx';

const FAILURE_COPY: Readonly<Record<SeatEventFailure, MessageKey>> = {
  not_allowed: 'tablet.seats.notAllowed',
  invalid: 'tablet.seats.invalid',
  pending: 'tablet.seats.pending',
  paused: 'tablet.seats.paused',
  unavailable: 'tablet.seats.unavailable',
};

interface SeatPanelProps {
  seat: TabletSeat;
  player: TabletPlayer;
  onLeft: () => void;
}

/**
 * The chosen seat, as in the prototype: who sits there and their call time; Away or Back; Player left; and food for
 * the seat. No buy-in: the tablet shows no money (owner, 29 Oct, #630).
 */
export function SeatPanel({ seat, player, onLeft }: SeatPanelProps) {
  const { setAway, leave } = useSeatEvents();
  const [failure, setFailure] = useState<SeatEventFailure | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const report = (done: { ok: true } | { ok: false; error: SeatEventFailure }) => setFailure(done.ok ? null : done.error);
  const awayLabel = player.isAway ? t('tablet.seats.back') : t('tablet.seats.away');
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('tablet.seats.title', { seat: seat.seat, name: player.fullName })}</Heading>
      {player.isAway ? <Text tone="muted">{t('tablet.seats.isAway')}</Text> : null}
      {player.callTimeLeft === null ? null : <CallTimeTimer secondsLeft={player.callTimeLeft} isPaused={player.isAway} />}
      <Inline gap={4}>
        <Button variant="text" isDisabled={setAway.isPending} onClick={() => void setAway.mutateAsync({ sessionId: player.sessionId, isAway: !player.isAway }).then(report)}>{awayLabel}</Button>
        <Button variant="text" isDisabled={leave.isPending} onClick={() => void leave.mutateAsync(player.sessionId).then((done) => { report(done); if (done.ok) onLeft(); })}>
          {t('tablet.seats.left')}
        </Button>
        <Button variant="text" onClick={() => setIsOrdering(true)}>{t('tablet.fnb.open')}</Button>
      </Inline>
      {isOrdering ? <SeatFnbOrder seat={seat.seat} onClose={() => setIsOrdering(false)} /> : null}
      {failure === null ? null : <ErrorMessage>{t(FAILURE_COPY[failure])}</ErrorMessage>}
    </Stack>
  );
}
