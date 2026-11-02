import { useServeFnbOrder, type FnbFailure, type FnbOrderTonight } from '@rivr/db/fnb';
import { formatDuration, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState, type ReactNode } from 'react';
import { VoidOrder } from './VoidOrder.tsx';

/** How long an order waited, or took to deliver, or why it is void (decision 0302). */
function timeLine(order: FnbOrderTonight): string {
  const time = formatDuration(order.ageSeconds);
  if (order.cancelReason !== null) return t('console.fnb.voidedLine', { reason: order.cancelReason });
  return order.deliveredAt === null ? t('console.fnb.waitingFor', { time }) : t('console.fnb.deliveredIn', { time });
}

/** One order: its KOT, table, seat and member, its lines, and its time: waiting so long, delivered in so long, or void. */
function ServeRow({ order, action }: { order: FnbOrderTonight; action?: ReactNode }) {
  return (
    <Inline gap={4} align="center" justify="between" wrap>
      <Stack gap={1}>
        <Text weight="semibold">
          {t('console.fnb.order', { kot: order.kotNumber, table: order.tableName, seat: order.seat, member: order.memberName, number: order.memberNumber })}
        </Text>
        <Text variant="small">{order.lines.map((line) => t('console.fnb.line', { quantity: line.quantity, name: line.name })).join(', ')}</Text>
        <Text variant="small" tone="muted">{timeLine(order)}</Text>
      </Stack>
      {action}
    </Inline>
  );
}

/** One of the three lists, with its heading and what it says when empty. */
function Section({ title, empty, children }: { title: string; empty: string; children: ReactNode[] }) {
  return (
    <Stack gap={3}>
      <Heading level={2}>{title}</Heading>
      {children.length === 0 ? <Text tone="muted">{empty}</Text> : <Stack gap={3} divided>{children}</Stack>}
    </Stack>
  );
}

/** Tonight's orders by where they stand: placed, being prepared, delivered, and void (decision 0302). */
function sectionsOf(orders: readonly FnbOrderTonight[]) {
  const standing = orders.filter((order) => order.cancelledAt === null);
  return {
    placed: standing.filter((order) => order.acceptedAt === null),
    preparing: standing.filter((order) => order.acceptedAt !== null && order.deliveredAt === null),
    delivered: standing.filter((order) => order.deliveredAt !== null),
    voided: orders.filter((order) => order.cancelledAt !== null),
  };
}

/** A standing order's next step, Accept or Deliver, with Void beside it (decision 0302). */
function StepActions({ venueId, order, step }: { venueId: string; order: FnbOrderTonight; step: ReactNode }) {
  return (
    <Inline gap={2} align="center" wrap>
      {step}
      <VoidOrder venueId={venueId} order={order} />
    </Inline>
  );
}

type Serve = ReturnType<typeof useServeFnbOrder>;
type Act = (done: Promise<{ ok: true } | { ok: false; error: FnbFailure }>) => Promise<void>;

/** An order being prepared: On its way as a runner leaves with it (the member's tracker reads it, decision 0320), and delivered. */
function PreparingActions({ order, serve, act }: { order: FnbOrderTonight; serve: Pick<Serve, 'sendOnWay' | 'deliver'>; act: Act }) {
  const { sendOnWay, deliver } = serve;
  return (
    <Inline gap={2} wrap>
      {order.onWayAt === null ? (
        <Button variant="secondary" isLoading={sendOnWay.isPending && sendOnWay.variables === order.orderId}
          onClick={() => void act(sendOnWay.mutateAsync(order.orderId))}>{t('console.fnb.onWay', { kot: order.kotNumber })}</Button>
      ) : <Text variant="small" weight="medium">{t('console.fnb.isOnWay')}</Text>}
      <Button variant="secondary" isLoading={deliver.isPending && deliver.variables === order.orderId} onClick={() => void act(deliver.mutateAsync(order.orderId))}>
        {t('console.fnb.deliver', { kot: order.kotNumber })}
      </Button>
    </Inline>
  );
}

/**
 * Serving tonight's orders (#640): those placed, to accept, each with the time it has waited; those accepted, being
 * prepared, to mark delivered; those delivered, with how long each took; and those void, with why. An order not yet
 * delivered can be voided with a reason (decision 0302). For Service, the floor and the super admin.
 */
export function ServeOrders({ venueId, orders }: { venueId: string; orders: readonly FnbOrderTonight[] }) {
  const { accept, sendOnWay, deliver } = useServeFnbOrder(venueId);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const act = async (done: Promise<{ ok: true } | { ok: false; error: FnbFailure }>) => {
    const outcome = await done;
    setFailure(outcome.ok ? null : outcome.error);
  };
  const { placed, preparing, delivered, voided } = sectionsOf(orders);
  return (
    <Stack gap={8}>
      {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
      <Section title={t('console.fnb.toAccept')} empty={t('console.fnb.noneToAccept')}>
        {placed.map((order) => <ServeRow key={order.orderId} order={order} action={<StepActions venueId={venueId} order={order} step={(
          <Button variant="primary" isLoading={accept.isPending && accept.variables === order.orderId} onClick={() => void act(accept.mutateAsync(order.orderId))}>
            {t('console.fnb.accept', { kot: order.kotNumber })}
          </Button>
        )} />} />)}
      </Section>
      <Section title={t('console.fnb.preparing')} empty={t('console.fnb.nonePreparing')}>
        {preparing.map((order) => (
          <ServeRow key={order.orderId} order={order}
            action={<StepActions venueId={venueId} order={order} step={<PreparingActions order={order} serve={{ sendOnWay, deliver }} act={act} />} />} />
        ))}
      </Section>
      <Section title={t('console.fnb.delivered')} empty={t('console.fnb.noneDelivered')}>
        {delivered.map((order) => <ServeRow key={order.orderId} order={order} />)}
      </Section>
      {voided.length === 0 ? null : (
        <Section title={t('console.fnb.voided')} empty="">{voided.map((order) => <ServeRow key={order.orderId} order={order} />)}</Section>
      )}
    </Stack>
  );
}
