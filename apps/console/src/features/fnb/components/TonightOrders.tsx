import { useFnbActions, useFnbOrdersTonight, type FnbFailure, type FnbOrderTonight } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Button, ErrorMessage, Heading, Inline, LoadState, Stack, Text } from '@rivr/ui';
import { useState, type ReactNode } from 'react';

const AT_BAR = { agent: 'console.fnb.byAgent', staff: 'console.fnb.byStaff' } as const;

/** An order in one line, then its lines, paid or comp, and whether the bar has the KOT. */
function OrderRow({ order, action }: { order: FnbOrderTonight; action?: ReactNode }) {
  const atBar = order.kotSentBy === null ? t('console.fnb.waiting') : t(AT_BAR[order.kotSentBy]);
  return (
    <Inline gap={4} align="center" justify="between" wrap>
      <Stack gap={1}>
        <Text weight="semibold">
          {t('console.fnb.order', { kot: order.kotNumber, table: order.tableName, seat: order.seat, member: order.memberName, number: order.memberNumber })}
        </Text>
        <Text variant="small">{order.lines.map((line) => t('console.fnb.line', { quantity: line.quantity, name: line.name })).join(', ')}</Text>
        <Text variant="small" tone="muted">{`${t(order.isComp ? 'console.fnb.comp' : 'console.fnb.paid')} · ${atBar}`}</Text>
      </Stack>
      {action}
    </Inline>
  );
}

/** The KOTs not yet at the bar, each to mark sent once handed over, then every order tonight. */
export function TonightOrders({ venueId }: { venueId: string }) {
  const orders = useFnbOrdersTonight(venueId);
  const { markSent } = useFnbActions(venueId);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  if (orders.data === undefined) return <LoadState isError={orders.isError} onRetry={() => void orders.refetch()} />;
  const waiting = orders.data.filter((order) => order.kotSentBy === null);
  const send = async (orderId: string) => {
    const done = await markSent.mutateAsync(orderId);
    setFailure(done.ok ? null : done.error);
  };
  return (
    <Stack gap={8}>
      <Stack gap={3}>
        <Heading level={2}>{t('console.fnb.toPrint')}</Heading>
        <Text variant="small" tone="muted">{t('console.fnb.toPrintHint')}</Text>
        {waiting.length === 0 ? <Text>{t('console.fnb.noneToPrint')}</Text> : waiting.map((order) => (
          <OrderRow key={order.orderId} order={order} action={(
            <Button variant="secondary" isLoading={markSent.isPending} onClick={() => void send(order.orderId)}>
              {t('console.fnb.markSent', { kot: order.kotNumber })}
            </Button>
          )} />
        ))}
        {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
      </Stack>
      <Stack gap={3}>
        <Heading level={2}>{t('console.fnb.tonight')}</Heading>
        {orders.data.length === 0 ? <Text>{t('console.fnb.noneTonight')}</Text> : (
          <Stack gap={3} divided>{orders.data.map((order) => <OrderRow key={order.orderId} order={order} />)}</Stack>
        )}
      </Stack>
    </Stack>
  );
}
