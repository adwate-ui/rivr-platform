import type { FnbOrderTonight } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';

/** Where an order stands tonight (console v3): to accept, being prepared, or delivered. A void order is in none. */
export type OrderLane = 'toAccept' | 'preparing' | 'delivered';

export const ORDER_LANES: readonly OrderLane[] = ['toAccept', 'preparing', 'delivered'];

/** The lane an order is in, or null for a void one, which goes to no bar and leaves the lanes. */
export function laneOf(order: FnbOrderTonight): OrderLane | null {
  if (order.cancelledAt !== null) return null;
  if (order.acceptedAt === null) return 'toAccept';
  return order.deliveredAt === null ? 'preparing' : 'delivered';
}

/** Tonight's orders in their lanes, oldest first. */
export function ordersByLane(orders: readonly FnbOrderTonight[]): Record<OrderLane, FnbOrderTonight[]> {
  const lanes: Record<OrderLane, FnbOrderTonight[]> = { toAccept: [], preparing: [], delivered: [] };
  const oldestFirst = [...orders].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.kotNumber - b.kotNumber);
  for (const order of oldestFirst) {
    const lane = laneOf(order);
    if (lane !== null) lanes[lane].push(order);
  }
  return lanes;
}

/** What was ordered, in one line: `2 × Beer, 1 × French fries`. */
export function orderLines(order: FnbOrderTonight): string {
  return order.lines.map((line) => t('console.fnb.line', { quantity: line.quantity, name: line.name })).join(', ');
}

/** Where the order goes: `Private Room, seat 4 · Lalit Goel`. */
export function orderWhere(order: FnbOrderTonight): string {
  return t('console.fnb.where', { table: order.tableName, seat: order.seat, member: order.memberName });
}
