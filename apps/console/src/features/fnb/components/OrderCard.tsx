import { useServeFnbOrder, type FnbFailure, type FnbOrderTonight } from '@rivr/db/fnb';
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

/** An order being prepared: Delivered, and On its way as a runner leaves with it (the member's tracker reads it, decision 0320). */
function PreparingSteps({ order, serve, act }: StepProps) {
  const { sendOnWay, deliver } = serve;
  return (
    <>
      <Button variant="strong" size="small" aria-label={t('console.fnb.deliverName', { kot: order.kotNumber })}
        isLoading={deliver.isPending && deliver.variables === order.orderId} onClick={() => void act(deliver.mutateAsync(order.orderId))}>
        {t('console.fnb.deliver')}
      </Button>
      {order.onWayAt === null ? (
        <Button variant="subtle" size="small" aria-label={t('console.fnb.onWayName', { kot: order.kotNumber })}
          isLoading={sendOnWay.isPending && sendOnWay.variables === order.orderId} onClick={() => void act(sendOnWay.mutateAsync(order.orderId))}>
          {t('console.fnb.onWay')}
        </Button>
      ) : <Text variant="caption" tone="muted">{t('console.fnb.isOnWay')}</Text>}
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
  const time = formatDuration(order.ageSeconds);
  const note = orderNotes(order);
  return (
    <Box surface="raised" radius="md" padding={4} hairline={lane === 'toAccept' ? 'all' : 'none'}>
      <Stack gap={2}>
        <Inline gap={3} align="center" justify="between">
          <Text weight="semibold">{t('console.fnb.kot', { kot: order.kotNumber })}</Text>
          <Text variant="caption" tone="muted">{lane === 'delivered' ? t('console.fnb.deliveredIn', { time }) : time}</Text>
        </Inline>
        <Text variant="small">{orderWhere(order)}</Text>
        <Text variant="small" tone="muted">{orderLines(order)}</Text>
        {note === null ? null : <Text variant="small">{t('console.fnb.note', { note })}</Text>}
        {order.isKotPrintFailed ? <KotNotAtBar venueId={venueId} order={order} /> : null}
        {order.isComp ? <Text variant="caption" weight="semibold">{t('console.fnb.comp')}</Text> : null}
        <CardActions venueId={venueId} lane={lane} {...step} />
      </Stack>
    </Box>
  );
}
