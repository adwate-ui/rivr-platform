import type { FnbOrderTonight } from '@rivr/db/fnb';
import { t } from '@rivr/i18n';

/** Where an order stands tonight (console v3): to accept, being prepared, or delivered. A void order is in none. */
export type OrderLane = 'toAccept' | 'preparing' | 'delivered';

/** The lane an order is in, or null for a void one, which goes to no bar and leaves the lanes. */
export function laneOf(order: FnbOrderTonight): OrderLane | null {
  if (order.cancelledAt !== null) return null;
  if (order.acceptedAt === null) return 'toAccept';
  return order.deliveredAt === null ? 'preparing' : 'delivered';
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
