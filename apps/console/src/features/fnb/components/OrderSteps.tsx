import type { useServeFnbOrder, FnbFailure, FnbOrderTonight } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';
import { Button, Inline } from '@rivr/ui';
import { laneOf } from './orderLanes.ts';

type Serve = ReturnType<typeof useServeFnbOrder>;
/** Runs one serving step and says why it did not go through, or clears what it said. */
export type Act = (done: Promise<{ ok: true } | { ok: false; error: FnbFailure }>) => Promise<void>;

interface StepProps {
  order: FnbOrderTonight;
  serve: Serve;
  act: Act;
}

/** An order placed: Accept, the row's main action. */
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

/**
 * A standing order's actions on its row: its next step, then Void, which opens its reason under the row (decision 0302).
 * A delivered or void order has none.
 */
export function OrderSteps({ onVoid, ...step }: StepProps & { onVoid: () => void }) {
  const lane = laneOf(step.order);
  if (lane === null || lane === 'delivered') return null;
  return (
    <Inline gap={2} align="center" justify="end" wrap>
      {lane === 'toAccept' ? <AcceptStep {...step} /> : <PreparingSteps {...step} />}
      <Button variant="text" size="small" aria-label={t('console.fnb.voidName', { kot: step.order.kotNumber })} onClick={onVoid}>{t('console.fnb.void')}</Button>
    </Inline>
  );
}
