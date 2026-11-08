import { FNB_MEMBER_CANCEL_REASON } from '@rivr/contracts';
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

/** The KOTs members cancelled themselves tonight, the last three (F-048), so the bar can drop one it already holds: `KOT 12, KOT 15`. */
export function memberCancelledKots(orders: readonly FnbOrderTonight[]): string | null {
  const cancelled = orders.filter((order) => order.cancelReason === FNB_MEMBER_CANCEL_REASON).sort((a, b) => b.kotNumber - a.kotNumber).slice(0, 3);
  return cancelled.length === 0 ? null : cancelled.map((order) => t('console.fnb.kot', { kot: order.kotNumber })).join(', ');
}

/** What was ordered, in one line: `2 × Beer, 1 × French fries`. */
export function orderLines(order: FnbOrderTonight): string {
  return order.lines.map((line) => t('console.fnb.line', { quantity: line.quantity, name: line.name })).join(', ');
}

/** What the member asked of the bar (F-052): `No ice, Less spicy`; null with nothing asked. */
export function orderNotes(order: FnbOrderTonight): string | null {
  const notes = order.lines.flatMap((line) => (line.note === null ? [] : [line.note]));
  return notes.length === 0 ? null : notes.join(', ');
}

/** Where the order goes: `Private Room, seat 4 · Lalit Goel`. */
export function orderWhere(order: FnbOrderTonight): string {
  return t('console.fnb.where', { table: order.tableName, seat: order.seat, member: order.memberName });
}
