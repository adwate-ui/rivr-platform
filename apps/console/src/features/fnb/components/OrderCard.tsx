import { useServeFnbOrder, type FnbFailure, type FnbOrderTonight } from '@rivr/db/fnb';
import { isTicketLate } from '@rivr/domain/floorRequests';
import { formatDuration, t } from '@rivr/i18n';
import { Box, Button, Inline, Stack, Text } from '@rivr/ui';
import { KotNotAtBar } from './KotNotAtBar.tsx';
import { orderLines, orderNotes, orderWhere, type OrderLane } from './orderLanes.ts';
import { VoidOrder } from './VoidOrder.tsx';

type Serve = ReturnType<typeof useServeFnbOrder>;
/** Runs one serving step and says why it did not go through, or clears what it said. */
export type Act = (done: Promise<{ ok: true } | { ok: false; error: FnbFailure }>) => Promise<void>;

interface StepProps {
  order: FnbOrderTonight;
  serve: Serve;
  act: Act;
}

/** An order placed: Accept, the card's main action. */
function AcceptStep({ order, serve, act }: StepProps) {
  const { accept } = serve;
  return (
    <Button variant="strong" size="small" aria-label={t('console.fnb.acceptName', { kot: order.kotNumber })}
      isLoading={accept.isPending && accept.variables === order.orderId} onClick={() => void act(accept.mutateAsync(order.orderId))}>
      {t('console.fnb.accept')}
    </Button>
  );
}

/** An order being prepared, its steps in order: On its way as a runner leaves with it (the member's tracker reads it, decision 0320), then Delivered. */
function PreparingSteps({ order, serve, act }: StepProps) {
  const { sendOnWay, deliver } = serve;
  return (
    <>
      {order.onWayAt === null ? (
        <Button variant="subtle" size="small" aria-label={t('console.fnb.onWayName', { kot: order.kotNumber })}
          isLoading={sendOnWay.isPending && sendOnWay.variables === order.orderId} onClick={() => void act(sendOnWay.mutateAsync(order.orderId))}>
          {t('console.fnb.onWay')}
        </Button>
      ) : null}
      <Button variant="strong" size="small" aria-label={t('console.fnb.deliverName', { kot: order.kotNumber })}
        isLoading={deliver.isPending && deliver.variables === order.orderId} onClick={() => void act(deliver.mutateAsync(order.orderId))}>
        {t('console.fnb.deliver')}
      </Button>
    </>
  );
}

/** A standing order's actions: its next step, then Void with a reason (decision 0302). A delivered order has none. */
function CardActions({ venueId, lane, ...step }: StepProps & { venueId: string; lane: OrderLane }) {
  if (lane === 'delivered') return null;
  return (
    <Inline gap={2} align="center" wrap>
      {lane === 'toAccept' ? <AcceptStep {...step} /> : <PreparingSteps {...step} />}
      <VoidOrder venueId={venueId} order={step.order} />
    </Inline>
  );
}

/** The card's top line: how long a delivered order took; a standing one's age, that it is on its way, and if it is late (audit F-075, F-096). */
function ageLine(order: FnbOrderTonight, lane: OrderLane): { text: string; isLate: boolean } {
  const time = formatDuration(order.ageSeconds);
  if (lane === 'delivered') return { text: t('console.fnb.deliveredIn', { time }), isLate: false };
  const age = order.onWayAt === null ? time : t('console.fnb.onWayAge', { time });
  return isTicketLate(order.ageSeconds) ? { text: t('console.fnb.late', { age }), isLate: true } : { text: age, isLate: false };
}

/** A standing order whose guest is going or has gone (audit F-085): the runner delivers at the door, or voids it with a reason. */
function SeatNote({ order, lane }: { order: FnbOrderTonight; lane: OrderLane }) {
  if (lane === 'delivered' || order.seatState === 'seated') return null;
  return <Text variant="small" weight="semibold">{t(order.seatState === 'left' ? 'console.fnb.seatLeft' : 'console.fnb.seatLeaving')}</Text>;
}

interface OrderCardProps extends StepProps {
  venueId: string;
  lane: OrderLane;
}

/**
 * One order on its lane (console v3): its KOT and how long it has waited, or took; where it goes; what was ordered; the
 * bar printer's miss, when the outbox says so; Comp; and its next step. An order to accept carries the gold hairline.
 */
export function OrderCard({ venueId, lane, ...step }: OrderCardProps) {
  const { order } = step;
  const age = ageLine(order, lane);
  const note = orderNotes(order);
  return (
    <Box surface="raised" radius="md" padding={4} hairline={lane === 'toAccept' ? 'all' : 'none'}>
      <Stack gap={2}>
        <Inline gap={3} align="center" justify="between">
          <Text weight="semibold">{t('console.fnb.kot', { kot: order.kotNumber })}</Text>
          <Text variant="caption" tone={age.isLate ? 'danger' : 'muted'}>{age.text}</Text>
        </Inline>
        <Text variant="small">{orderWhere(order)}</Text>
        <SeatNote order={order} lane={lane} />
        <Text variant="small" tone="muted">{orderLines(order)}</Text>
        {note === null ? null : <Text variant="small">{t('console.fnb.note', { note })}</Text>}
        {order.isKotPrintFailed ? <KotNotAtBar venueId={venueId} order={order} /> : null}
        {order.isComp ? <Text variant="caption" weight="semibold">{t('console.fnb.comp')}</Text> : null}
        <CardActions venueId={venueId} lane={lane} {...step} />
      </Stack>
    </Box>
  );
}
