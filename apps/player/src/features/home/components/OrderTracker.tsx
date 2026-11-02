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

/**
 * Tonight's latest order at the seat (brief 3.4 E): what, where it stands in gold, and the four steps, Sent, Preparing, On
 * its way, Delivered (@rivr/domain orderStage); delivered, Order again opens the Order screen with it. Read out as it moves.
 */
export function OrderTracker() {
  const fnb = useFeature('fnb.table_side');
  const navigate = useNavigate();
  const order = useMyFnbOrders().data?.[0];
  if (order === undefined) return null;
  const stage = orderStage(order);
  return (
    <FeatureGate access={fnb}>
      <Box paddingX={5} paddingY={4}>
        <Box padding={4} hairline="all" radius="lg" isLive>
          <Stack gap={4}>
            <Inline justify="between" align="baseline" gap={3}>
              <Text weight="medium">{itemsOf(order)}</Text>
              <Text variant="small" tone="accent">{t(`player.live.seat.stages.${stage}`)}</Text>
            </Inline>
            <Stepper label={t('player.live.seat.orderLabel')} current={ORDER_STAGES.indexOf(stage)}
              steps={ORDER_STAGES.map((each) => t(`player.live.seat.stages.${each}`))} />
            {stage === 'delivered' ? (
              <Button variant="outline" fullWidth onClick={() => void navigate({ href: `/fnb?again=${order.orderId}` })}>{t('player.live.seat.orderAgain')}</Button>
            ) : null}
          </Stack>
        </Box>
      </Box>
    </FeatureGate>
  );
}
