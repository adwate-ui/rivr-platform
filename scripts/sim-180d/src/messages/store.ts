/**
 * The outbox as the copy's database keeps it, reached with the service role over HTTP, exactly as the Edge
 * Functions reach it: a Node copy of supabase/functions/_shared/outbox.ts (rpc, toDelivery, outboxStore), which
 * runs only under Deno. Keep the two in step.
 */
import type { ClaimedDelivery, OutboxStore } from '@rivr/adapters';

export type Rpc = (name: string, args: object) => Promise<unknown>;

/** Calls a database function with the service role; throws when it fails, so a delivery is tried again. */
export function createRpc(apiUrl: string, serviceRoleKey: string, fetcher: typeof fetch = fetch): Rpc {
  const headers = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };
  return async (name, args) => {
    const answer = await fetcher(`${apiUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(args),
      signal: AbortSignal.timeout(5_000),
    });
    if (!answer.ok) throw new Error(`${name} failed (${answer.status})`);
    return answer.status === 204 ? null : await answer.json();
  };
}

export function toDelivery(row: unknown): ClaimedDelivery {
  const field = (name: string): unknown => (typeof row === 'object' && row !== null ? Reflect.get(row, name) : undefined);
  return {
    deliveryId: String(field('delivery_id')),
    eventId: String(field('event_id')),
    venueId: String(field('venue_id')),
    eventType: String(field('event_type')),
    payload: field('payload'),
    attempts: Number(field('attempts')),
    occurredAt: new Date(String(field('occurred_at'))),
  };
}

export function createOutboxStore(rpc: Rpc): OutboxStore {
  return {
    async claim({ consumer, eventTypes, isMessaging, limit }) {
      const rows = await rpc('claim_outbox_deliveries', {
        p_consumer: consumer,
        p_event_types: eventTypes,
        p_is_messaging: isMessaging,
        p_limit: limit,
      });
      return Array.isArray(rows) ? rows.map(toDelivery) : [];
    },
    async finish({ deliveryId, attempts, isDelivered, error, retryAfterSeconds }) {
      await rpc('finish_outbox_delivery', {
        p_delivery_id: deliveryId,
        p_delivered: isDelivered,
        p_error: error,
        p_retry_after: retryAfterSeconds === null ? null : `${retryAfterSeconds} seconds`,
        p_attempts: attempts,
      });
    },
  };
}
