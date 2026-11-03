import { useServeFnbOrder, type FnbFailure, type FnbOrderTonight } from '@rivr/db/fnb';
import { formatNumber, t } from '@rivr/i18n';
import { Box, ErrorMessage, Grid, Heading, Inline, Stack, Text } from '@rivr/ui';
import { useId, useState } from 'react';
import { OrderCard, type Act } from './OrderCard.tsx';
import { ORDER_LANES, ordersByLane, type OrderLane } from './orderLanes.ts';

interface LaneProps {
  venueId: string;
  lane: OrderLane;
  orders: readonly FnbOrderTonight[];
  serve: ReturnType<typeof useServeFnbOrder>;
  act: Act;
  canMarkSent: boolean;
}

/** One lane: its name and count, then its orders oldest first, or that it has none. */
function Lane({ venueId, lane, orders, serve, act, canMarkSent }: LaneProps) {
  const headingId = useId();
  return (
    <Box as="section" aria-labelledby={headingId}>
      <Stack gap={3}>
        <Inline gap={3} align="center" justify="between">
          <Heading level={2} variant="subsection" id={headingId}>{t(`console.fnb.${lane}`)}</Heading>
          <Text variant="caption" tone="muted" isTabular>{formatNumber(orders.length)}</Text>
        </Inline>
        {orders.length === 0 ? <Text variant="small" tone="muted">{t('console.fnb.laneEmpty')}</Text> : orders.map((order) => (
          <OrderCard key={order.orderId} venueId={venueId} lane={lane} order={order} serve={serve} act={act} canMarkSent={canMarkSent} />
        ))}
      </Stack>
    </Box>
  );
}

/**
 * Tonight's orders in three lanes (console v3): to accept, being prepared, and delivered tonight. A void order goes to no
 * bar and leaves them. Service, the floor and the managers serve from here (#640, decision 0302).
 */
export function OrderBoard({ venueId, orders, canMarkSent }: { venueId: string; orders: readonly FnbOrderTonight[]; canMarkSent: boolean }) {
  const serve = useServeFnbOrder(venueId);
  const [failure, setFailure] = useState<FnbFailure | null>(null);
  const act: Act = async (done) => {
    const outcome = await done;
    setFailure(outcome.ok ? null : outcome.error);
  };
  const lanes = ordersByLane(orders);
  return (
    <Stack gap={4}>
      {failure === null ? null : <ErrorMessage>{t(`console.fnb.failures.${failure}`)}</ErrorMessage>}
      <Grid columns={3} gap={4} stackBelow="medium">
        {ORDER_LANES.map((lane) => (
          <Lane key={lane} venueId={venueId} lane={lane} orders={lanes[lane]} serve={serve} act={act} canMarkSent={canMarkSent} />
        ))}
      </Grid>
    </Stack>
  );
}
