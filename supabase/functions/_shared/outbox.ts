// What every outbox consumer Edge Function shares (#12): the store that claims and finishes
// deliveries through the database's own functions, with the service role, and the request handler
// that runs a consumer once. A consumer's index.ts is then one line:
//   Deno.serve(serveConsumer({ name, eventTypes, isMessaging, deliver }));
// pg_cron calls each consumer with the service role on its schedule (added with the first consumer).
// Practice-venue events never reach a consumer: claim_outbox_deliveries leaves them out.
import { runConsumer, type ClaimedDelivery, type Consumer, type OutboxStore } from '@rivr/adapters';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AS_SERVER = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };

async function rpc(name: string, args: object): Promise<unknown> {
  const answer = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, { method: 'POST', headers: AS_SERVER, body: JSON.stringify(args) });
  if (!answer.ok) throw new Error(`${name} failed (${answer.status})`);
  return answer.status === 204 ? null : await answer.json();
}

function toDelivery(row: unknown): ClaimedDelivery {
  const field = (name: string): unknown => (typeof row === 'object' && row !== null ? Reflect.get(row, name) : undefined);
  return {
    deliveryId: String(field('delivery_id')),
    eventId: String(field('event_id')),
    venueId: String(field('venue_id')),
    eventType: String(field('event_type')),
    payload: field('payload'),
    attempts: Number(field('attempts')),
  };
}

/** The outbox as the database keeps it, reached with the service role. */
export const outboxStore: OutboxStore = {
  async claim({ consumer, eventTypes, isMessaging, limit }) {
    const rows = await rpc('claim_outbox_deliveries', {
      p_consumer: consumer, p_event_types: eventTypes, p_is_messaging: isMessaging, p_limit: limit,
    });
    return Array.isArray(rows) ? rows.map(toDelivery) : [];
  },
  async finish({ deliveryId, isDelivered, error, retryAfterSeconds }) {
    await rpc('finish_outbox_delivery', {
      p_delivery_id: deliveryId, p_delivered: isDelivered, p_error: error, p_retry_after: `${retryAfterSeconds} seconds`,
    });
  },
};

/** The request handler for one consumer: only the service role (pg_cron) may run it. */
export function serveConsumer(consumer: Consumer): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });
    if (serviceRoleKey === '' || request.headers.get('authorization') !== `Bearer ${serviceRoleKey}`) {
      return Response.json({ error: 'Only the scheduler runs a consumer' }, { status: 403 });
    }
    return Response.json(await runConsumer(outboxStore, consumer));
  };
}
