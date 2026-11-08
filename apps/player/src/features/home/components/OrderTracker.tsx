import { FNB_MEMBER_CANCEL_REASON } from '@rivr/contracts';
import { useFeature } from '@rivr/db';
import { useCancelMyFnbOrder, useMyFnbOrders, type CancelMyOrderFailure, type MyFnbOrder } from '@rivr/db/fnb';
import { ORDER_STAGES, orderStage } from '@rivr/domain/fnb';
import { t } from '@rivr/i18n';
import { Box, Button, ConfirmButton, ErrorMessage, FeatureGate, Inline, Stack, Stepper, Text, useIsOnline } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

/** What was ordered: "Club sandwich, Paneer tikka", or "2 × Beer". */
function itemsOf(order: MyFnbOrder): string {
  return order.lines.map((line) => (line.quantity > 1 ? t('player.live.seat.many', { quantity: line.quantity, name: line.name }) : line.name))
    .join(t('player.fnb.itemsSeparator'));
}

/** Order again: the Order screen with this order's lines in. */
function OrderAgain({ orderId }: { orderId: string }) {
  const navigate = useNavigate();
  return <Button variant="outline" fullWidth onClick={() => void navigate({ href: `/fnb?again=${orderId}` })}>{t('player.live.seat.orderAgain')}</Button>;
}

/** Cancel, asked once more, while the bar has not accepted the order (F-048); it says so if the bar got there first. Off with no connection. */
function CancelOrder({ orderId }: { orderId: string }) {
  const cancel = useCancelMyFnbOrder();
  const isOnline = useIsOnline();
  const [failure, setFailure] = useState<CancelMyOrderFailure | null>(null);
  const press = async () => {
    const done = await cancel.mutateAsync(orderId);
    setFailure(done.ok ? null : done.error);
  };
  return (
    <Stack gap={2}>
      <ConfirmButton label={t('player.live.seat.cancelOrder')} confirm={t('player.live.seat.cancelOrderConfirm')} isBusy={cancel.isPending} isDisabled={!isOnline} onConfirm={() => void press()} />
      {failure === null ? null : <ErrorMessage look="dot">{t(`player.live.seat.cancelFailures.${failure}`)}</ErrorMessage>}
    </Stack>
  );
}

/** The four steps and where the order stands on them, or, once it was cancelled, that it was and why (decision 0302). */
function Progress({ order }: { order: MyFnbOrder }) {
  if (order.cancelReason !== null) {
    return (
      <Stack gap={4}>
        <Text variant="small" tone="muted">{order.cancelReason === FNB_MEMBER_CANCEL_REASON ? t('player.fnb.cancelledByYou') : t('player.fnb.cancelled', { reason: order.cancelReason })}</Text>
        <OrderAgain orderId={order.orderId} />
      </Stack>
    );
  }
  const stage = orderStage(order);
  return (
    <Stack gap={4}>
      <Stepper label={t('player.live.seat.orderLabel')} current={ORDER_STAGES.indexOf(stage)}
        steps={ORDER_STAGES.map((each) => t(`player.live.seat.stages.${each}`))} />
      {stage === 'delivered' ? <OrderAgain orderId={order.orderId} /> : null}
      {stage === 'sent' ? <CancelOrder orderId={order.orderId} /> : null}
    </Stack>
  );
}

/**
 * Tonight's latest order at the seat (brief 3.4 E): what, where it stands in gold, and the four steps, Sent, Preparing, On
 * its way, Delivered (@rivr/domain orderStage); while it is Sent, Cancel (F-048); delivered, Order again opens the Order
 * screen with it. One cancelled says so, with why, and offers Order again. Read out as it moves.
 */
export function OrderTracker() {
  const fnb = useFeature('fnb.table_side');
  const order = useMyFnbOrders().data?.[0];
  if (order === undefined) return null;
  const isCancelled = order.cancelReason !== null;
  return (
    <FeatureGate access={fnb}>
      <Box paddingX={5} paddingY={4}>
        <Box padding={4} hairline="all" radius="lg" isLive>
          <Stack gap={4}>
            <Inline justify="between" align="baseline" gap={3}>
              <Text weight="medium">{itemsOf(order)}</Text>
              {isCancelled ? null : <Text variant="small" tone="accent">{t(`player.live.seat.stages.${orderStage(order)}`)}</Text>}
            </Inline>
            <Progress order={order} />
          </Stack>
        </Box>
      </Box>
    </FeatureGate>
  );
}
