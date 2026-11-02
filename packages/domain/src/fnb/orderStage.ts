/** The four steps the member's order tracker shows (decision 0320), in order. */
export const ORDER_STAGES = ['sent', 'preparing', 'on_its_way', 'delivered'] as const;

/** Where an order stands: sent to the bar, being prepared, on its way to the seat, or delivered. */
export type OrderStage = (typeof ORDER_STAGES)[number];

/** When the bar took each step; null for a step not taken. */
export interface OrderSteps {
  readonly acceptedAt: string | null;
  readonly onWayAt: string | null;
  readonly deliveredAt: string | null;
}

/**
 * An order's stage from the bar's steps (brief 7.3): placed is Sent, accepted Preparing, on its way On its way, delivered
 * Delivered. The furthest step taken wins, so an order delivered without being marked on its way reads Delivered.
 */
export function orderStage({ acceptedAt, onWayAt, deliveredAt }: OrderSteps): OrderStage {
  if (deliveredAt !== null) return 'delivered';
  if (onWayAt !== null) return 'on_its_way';
  return acceptedAt === null ? 'sent' : 'preparing';
}
