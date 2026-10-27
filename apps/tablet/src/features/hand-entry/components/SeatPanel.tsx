import { useSeatEvents, type SeatEventFailure, type TabletPlayer, type TabletSeat } from '@rivr/db';
import { times, type Paise } from '@rivr/domain/money';
import { formatMoney, t, type MessageKey } from '@rivr/i18n';
import { Button, CallTimeTimer, ChoiceChips, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
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
 * The chosen seat, as in the prototype: who sits there; a buy-in of one, two or three times the
 * table's minimum, asked of the cage (flow 3), and while it waits there, how much; Away or Back;
 * Player left.
 */
export function SeatPanel({ seat, player, onLeft }: SeatPanelProps) {
  const { requestBuyIn, setAway, leave } = useSeatEvents();
  const amounts: Paise[] = [1n, 2n, 3n].map((count) => times(seat.minimum, count));
  const [amount, setAmount] = useState<Paise>(seat.minimum);
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  const [failure, setFailure] = useState<SeatEventFailure | null>(null);
  const [isOrdering, setIsOrdering] = useState(false);
  const report = (done: { ok: true } | { ok: false; error: SeatEventFailure }) => setFailure(done.ok ? null : done.error);
  const request = async () => {
    const asked = await requestBuyIn.mutateAsync({ sessionId: player.sessionId, amount, requestId });
    report(asked);
    if (asked.ok) setRequestId(crypto.randomUUID());
  };
  const awayLabel = player.isAway ? t('tablet.seats.back') : t('tablet.seats.away');
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('tablet.seats.title', { seat: seat.seat, name: player.fullName })}</Heading>
      {player.isAway ? <Text tone="muted">{t('tablet.seats.isAway')}</Text> : null}
      {player.callTimeLeft === null ? null : <CallTimeTimer secondsLeft={player.callTimeLeft} isPaused={player.isAway} />}
      <Inline gap={3} align="end" wrap>
        <ChoiceChips label={t('tablet.seats.buyIn')} mode="one" selected={[String(amount)]}
          options={amounts.map((option) => ({ value: String(option), label: formatMoney(option) }))}
          onChange={([value]) => { const chosen = amounts.find((option) => String(option) === value); if (chosen !== undefined) { setAmount(chosen); setRequestId(crypto.randomUUID()); } }} />
        <Button variant="secondary" isLoading={requestBuyIn.isPending} isDisabled={player.pendingBuyIn !== null} onClick={() => void request()}>
          {t('tablet.seats.requestBuyIn')}
        </Button>
      </Inline>
      {player.pendingBuyIn === null ? null : <Text>{t('tablet.seats.withCage', { amount: formatMoney(player.pendingBuyIn) })}</Text>}
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
