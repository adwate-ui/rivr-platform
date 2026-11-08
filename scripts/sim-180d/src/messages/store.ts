/**
 * The outbox as the copy's database keeps it, reached with the service role over HTTP, exactly as the Edge
 * Functions reach it: a Node copy of supabase/functions/_shared/outbox.ts (rpc, toDelivery, outboxStore), which
 * runs only under Deno. Keep the two in step.
 */
import type { ClaimedDelivery, OutboxStore } from '@rivr/adapters';

export type Rpc = (name: string, args: object) => Promise<unknown>;

// A connection the API closed (the stack restarts at each snapshot, leaving a stale keep-alive socket) fails with
// fetch's TypeError before anything is sent; that alone is tried again. An HTTP error or a timeout is not.
const TRIES = 3;
const PAUSE_MS = 500;

/** Calls a database function with the service role; throws when it fails, so a delivery is tried again. */
export function createRpc(apiUrl: string, serviceRoleKey: string, fetcher: typeof fetch = fetch, pauseMs = PAUSE_MS): Rpc {
  const headers = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };
  const post = (name: string, args: object): Promise<Response> =>
    fetcher(`${apiUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers, body: JSON.stringify(args), signal: AbortSignal.timeout(5_000) });
  return async (name, args) => {
    for (let attempt = 1; ; attempt += 1) {
      try {
        const answer = await post(name, args);
        if (!answer.ok) throw new Error(`${name} failed (${answer.status})`);
        return answer.status === 204 ? null : await answer.json();
      } catch (error) {
        if (attempt >= TRIES || !(error instanceof TypeError)) throw error;
        await new Promise((resolve) => setTimeout(resolve, pauseMs));
      }
    }
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
