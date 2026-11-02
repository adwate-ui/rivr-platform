import { FNB_ITEM_KINDS } from '@rivr/contracts';
import { useFeatureStatus, useMySeat } from '@rivr/db';
import { useMyFnbMenu, useMyFnbOrders, usePlaceFnbOrder, type FnbFailure, type FnbMenuItem, type MyFnbOrder } from '@rivr/db/fnb';
import { formatNumber, t } from '@rivr/i18n';
import { Button, ErrorMessage, FeatureGate, Heading, Inline, ItemPhoto, LoadState, QuantityStepper, Screen, Stack, StatusMessage, Text } from '@rivr/ui';
import { useState, type JSX } from 'react';

/**
 * The Menu tab (#123, #635; feature fnb.table_side): the member's menu (alcohol only at 21 or over) under Food, Soft
 * drinks and Bar, read only until they sit (UI polish audit A-06, A-07); how many of each, and Send to the bar; then
 * tonight's orders, each followed from placed, to being prepared, to delivered. An order goes
 * to their seat's visit, paid to Glaza when it comes, with a KOT at the bar. It waits until access is known.
 */
export function FnbOrderScreen() {
  const feature = useFeatureStatus('fnb.table_side');
  const title = t('player.fnb.title');
  if (feature.status === 'loading') return <Screen title={title} status="loading" />;
  if (feature.status === 'error') return <Screen title={title} status="error" onRetry={feature.retry} />;
  return (
    <Screen title={title}>
      <FeatureGate access={feature.access}>
        <Stack gap={8}>
          <FnbOrder />
          <Orders />
        </Stack>
      </FeatureGate>
    </Screen>
  );
}

/** The menu in its sections, each item as `item` draws it: its name, or how many to order. */
function MenuSections({ items, item }: { items: readonly FnbMenuItem[]; item: (menuItem: FnbMenuItem) => JSX.Element }) {
  return (
    <Stack gap={6}>
      {FNB_ITEM_KINDS.map((kind) => ({ kind, inKind: items.filter((menuItem) => menuItem.kind === kind) }))
        .filter(({ inKind }) => inKind.length > 0)
        .map(({ kind, inKind }) => (
          <Stack key={kind} gap={3}>
            <Heading level={2}>{t(`player.fnb.kinds.${kind}`)}</Heading>
            <Stack gap={3}>{inKind.map(item)}</Stack>
          </Stack>
        ))}
    </Stack>
  );
}

/** Before the member sits: the menu to read, and that ordering opens at a seat (UI polish audit A-06). */
function MenuBeforeSeat({ items }: { items: readonly FnbMenuItem[] }) {
  return (
    <Stack gap={6}>
      <Text>{t('player.fnb.notSeated')}</Text>
      <MenuSections items={items} item={(menuItem) => (
        <Inline key={menuItem.itemId} gap={3} align="center">
          <ItemPhoto src={menuItem.photoUrl} name={menuItem.name} size="sm" />
          <Text>{menuItem.name}</Text>
        </Inline>
      )} />
    </Stack>
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
  const seat = useMySeat();
  const menu = useMyFnbMenu();
  const place = usePlaceFnbOrder();
  const [counts, setCounts] = useState<Readonly<Record<string, number>>>({});
  const [sent, setSent] = useState<number | null>(null);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  // One id an order, kept to retry one whose reply was lost, and new with any change to it (F3-18), as the console's.
  const [requestId, setRequestId] = useState(() => crypto.randomUUID());
  // Whether they are seated is known before the menu says anything (F3-18): not "sit first" while it loads.
  if (seat.data === undefined) return <LoadState isError={seat.isError} onRetry={() => void seat.refetch()} />;
  if (menu.data === undefined) return <LoadState isError={menu.isError} onRetry={() => void menu.refetch()} />;
  if (menu.data.length === 0) return <Text>{t('player.fnb.empty')}</Text>;
  if (seat.data === null) return <MenuBeforeSeat items={menu.data} />;
  const mySeat = seat.data;
  const lines = Object.entries(counts).filter(([, quantity]) => quantity > 0).map(([itemId, quantity]) => ({ item_id: itemId, quantity }));
  const send = async () => {
    const outcome = await place.mutateAsync({ lines, requestId });
    if (outcome.ok || outcome.error !== 'unavailable') setRequestId(crypto.randomUUID());
    setFailure(outcome.ok ? null : outcome.error);
    setSent(outcome.ok ? outcome.value.kotNumber : null);
    if (outcome.ok) setCounts({});
  };
  return (
    <Stack gap={4}>
      <MenuSections items={menu.data} item={(item) => (
        <Inline key={item.itemId} gap={3} align="center">
          <ItemPhoto src={item.photoUrl} name={item.name} size="sm" />
          <Stack grow>
            <QuantityStepper label={item.name} value={counts[item.itemId] ?? 0}
              onChange={(quantity) => { setCounts({ ...counts, [item.itemId]: quantity }); setSent(null); setRequestId(crypto.randomUUID()); }} />
          </Stack>
        </Inline>
      )} />
      <Text variant="small" tone="muted">{t('player.fnb.paid')}</Text>
      <Button variant="primary" isDisabled={lines.length === 0} isLoading={place.isPending} onClick={() => void send()}>{t('player.fnb.send')}</Button>
      <StatusMessage>{sent === null ? null : t('player.fnb.sent', { kot: sent, table: mySeat.tableName, seat: mySeat.seat })}</StatusMessage>
      {failure === null ? null : <ErrorMessage>{t(`player.fnb.failures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}
