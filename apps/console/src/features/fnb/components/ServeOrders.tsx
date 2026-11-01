import { useServeFnbOrder, type FnbFailure, type FnbOrderTonight } from '@rivr/db/fnb';
import { formatDuration, t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useState, type ReactNode } from 'react';

/** One order: its KOT, table, seat and member, its lines, and its time: waiting so long, or delivered in so long. */
function ServeRow({ order, action }: { order: FnbOrderTonight; action?: ReactNode }) {
  const time = formatDuration(order.ageSeconds);
  return (
    <Inline gap={4} align="center" justify="between" wrap>
      <Stack gap={1}>
        <Text weight="semibold">
          {t('console.fnb.order', { kot: order.kotNumber, table: order.tableName, seat: order.seat, member: order.memberName, number: order.memberNumber })}
        </Text>
        <Text variant="small">{order.lines.map((line) => t('console.fnb.line', { quantity: line.quantity, name: line.name })).join(', ')}</Text>
        <Text variant="small" tone="muted">{order.deliveredAt === null ? t('console.fnb.waitingFor', { time }) : t('console.fnb.deliveredIn', { time })}</Text>
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

/**
 * Serving tonight's orders (#640): those placed, to accept, each with the time it has waited; those accepted, being
 * prepared, to mark delivered; and those delivered, with how long each took, for Service, the floor and the super admin.
 */
export function ServeOrders({ venueId, orders }: { venueId: string; orders: readonly FnbOrderTonight[] }) {
  const { accept, deliver } = useServeFnbOrder(venueId);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const act = async (done: Promise<{ ok: true } | { ok: false; error: FnbFailure }>) => {
    const outcome = await done;
    setFailure(outcome.ok ? null : outcome.error);
  };
  const placed = orders.filter((order) => order.acceptedAt === null);
  const preparing = orders.filter((order) => order.acceptedAt !== null && order.deliveredAt === null);
  const delivered = orders.filter((order) => order.deliveredAt !== null);
  return (
    <Stack gap={8}>
      {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
      <Section title={t('console.fnb.toAccept')} empty={t('console.fnb.noneToAccept')}>
        {placed.map((order) => (
          <ServeRow key={order.orderId} order={order} action={(
            <Button variant="primary" isLoading={accept.isPending && accept.variables === order.orderId} onClick={() => void act(accept.mutateAsync(order.orderId))}>
              {t('console.fnb.accept', { kot: order.kotNumber })}
            </Button>
          )} />
        ))}
      </Section>
      <Section title={t('console.fnb.preparing')} empty={t('console.fnb.nonePreparing')}>
        {preparing.map((order) => (
          <ServeRow key={order.orderId} order={order} action={(
            <Button variant="secondary" isLoading={deliver.isPending && deliver.variables === order.orderId} onClick={() => void act(deliver.mutateAsync(order.orderId))}>
              {t('console.fnb.deliver', { kot: order.kotNumber })}
            </Button>
          )} />
        ))}
      </Section>
      <Section title={t('console.fnb.delivered')} empty={t('console.fnb.noneDelivered')}>
        {delivered.map((order) => <ServeRow key={order.orderId} order={order} />)}
      </Section>
    </Stack>
  );
}
