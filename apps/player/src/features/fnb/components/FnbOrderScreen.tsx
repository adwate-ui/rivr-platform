import { useFeature, useMySeat } from '@rivr/db';
import { useMyFnbMenu, useMyFnbOrders, usePlaceFnbOrder, type FnbFailure, type MyFnbOrder } from '@rivr/db/fnb';
import { formatNumber, t } from '@rivr/i18n';
import { Button, ErrorMessage, FeatureGate, Heading, Inline, LoadState, QuantityStepper, Screen, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState } from 'react';

/**
 * The Menu tab (#123, #635; feature fnb.table_side): the member's menu (alcohol only at 21 or over), how many of each,
 * and Send to the bar; then tonight's orders, each followed from placed, to being prepared, to delivered. An order goes
 * to their seat's visit, paid to Glaza when it comes, with a KOT at the bar.
 */
export function FnbOrderScreen() {
  const access = useFeature('fnb.table_side');
  return (
    <Screen title={t('player.fnb.title')}>
      <FeatureGate access={access}>
        <Stack gap={8}>
          <FnbOrder />
          <Orders />
        </Stack>
      </FeatureGate>
    </Screen>
  );
}

/** One order: its KOT and what, and where it is. */
function OrderLine({ order }: { order: MyFnbOrder }) {
  const items = order.lines.map((line) => t('player.fnb.item', { quantity: formatNumber(line.quantity), name: line.name }))
    .join(t('player.fnb.itemsSeparator'));
  return (
    <Inline gap={4} justify="between" align="baseline">
      <Text>{t('player.fnb.orderLine', { kot: formatNumber(order.kotNumber), items })}</Text>
      <Text variant="small" weight="medium">{t(`player.fnb.progress.${order.progress}`)}</Text>
    </Inline>
  );
}

/** The member's orders tonight, newest first, or that there are none yet. */
function Orders() {
  const orders = useMyFnbOrders();
  return (
    <Stack gap={3}>
      <Heading level={2}>{t('player.fnb.yourOrders')}</Heading>
      {orders.data === undefined ? (
        <LoadState isError={orders.isError} errorText={t('player.fnb.ordersFailed')} onRetry={() => void orders.refetch()} />
      ) : orders.data.length === 0 ? <Text tone="muted">{t('player.fnb.noOrders')}</Text> : (
        <Stack gap={3} divided>{orders.data.map((order) => <OrderLine key={order.orderId} order={order} />)}</Stack>
      )}
    </Stack>
  );
}

function FnbOrder() {
  const seat = useMySeat().data ?? null;
  const menu = useMyFnbMenu();
  const place = usePlaceFnbOrder();
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>({});
  const [sent, setSent] = useState<number | null>(null);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  if (seat === null) return <Text>{t('player.fnb.notSeated')}</Text>;
  if (menu.data === undefined) return <LoadState isError={menu.isError} onRetry={() => void menu.refetch()} />;
  if (menu.data.length === 0) return <Text>{t('player.fnb.empty')}</Text>;
  const lines = Object.entries(counts).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ item_id: itemId, quantity }));
  const send = async () => {
    const outcome = await place.mutateAsync(lines);
    setFailure(outcome.ok ? null : outcome.error);
    setSent(outcome.ok ? outcome.value.kotNumber : null);
    if (outcome.ok) setCounts({});
  };
  return (
    <Stack gap={4}>
      <Stack gap={3}>
        {menu.data.map((item) => (
          <QuantityStepper key={item.itemId} label={item.name} value={counts[item.itemId] ?? 0}
            onChange={(quantity) => { setCounts({ ...counts, [item.itemId]: quantity }); setSent(null); }} />
        ))}
      </Stack>
      <Text variant="small" tone="muted">{t('player.fnb.paid')}</Text>
      <Button variant="primary" isDisabled={lines.length === 0} isLoading={place.isPending} onClick={() => void send()}>{t('player.fnb.send')}</Button>
      <StatusMessage>{sent === null ? null : t('player.fnb.sent', { kot: sent, table: seat.tableName, seat: seat.seat })}</StatusMessage>
      {failure === null ? null : <ErrorMessage>{t(`player.fnb.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}
