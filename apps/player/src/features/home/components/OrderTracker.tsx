import { useFeature } from '@rivr/db';
import { useMyFnbOrders, type MyFnbOrder } from '@rivr/db/fnb';
import { ORDER_STAGES, orderStage } from '@rivr/domain/fnb';
import { t } from '@rivr/i18n';
import { Box, Button, FeatureGate, Inline, Stack, Stepper, Text } from '@rivr/ui';
import { useNavigate } from '@tanstack/react-router';

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

/** The four steps and where the order stands on them, or, once staff voided it, that it was cancelled and why (decision 0302). */
function Progress({ order }: { order: MyFnbOrder }) {
  if (order.cancelReason !== null) {
    return (
      <Stack gap={4}>
        <Text variant="small" tone="muted">{t('player.fnb.cancelled', { reason: order.cancelReason })}</Text>
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
    </Stack>
  );
}

/**
 * Tonight's latest order at the seat (brief 3.4 E): what, where it stands in gold, and the four steps, Sent, Preparing, On
 * its way, Delivered (@rivr/domain orderStage); delivered, Order again opens the Order screen with it. One staff voided says
 * so, with why, and offers Order again. Read out as it moves.
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
