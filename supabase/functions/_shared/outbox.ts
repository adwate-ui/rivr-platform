// What every outbox consumer Edge Function shares (#12): the store that claims and finishes
// deliveries through the database's own functions, with the service role, and the request handler
// that runs a consumer once. A consumer's index.ts is then one line:
//   Deno.serve(serveConsumer({ name, eventTypes, isMessaging, deliver }));
// pg_cron calls each consumer every minute with the scheduler's secret (#215, decision 0038): the
// consumer's migration runs `select private.schedule_outbox_consumer('<function name>')`, and
// config.template.toml turns verify_jwt off for its function.
// Practice-venue events never reach a consumer: claim_outbox_deliveries leaves them out.
import { runConsumer, type ClaimedDelivery, type Consumer, type OutboxStore } from '@rivr/adapters';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AS_SERVER = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };

/** Calls a database function with the service role; throws when it fails, so a delivery is tried again. */
export async function rpc(name: string, args: object): Promise<unknown> {
  const answer = await fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST', headers: AS_SERVER, body: JSON.stringify(args), signal: AbortSignal.timeout(5_000),
  });
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
      p_delivery_id: deliveryId, p_delivered: isDelivered, p_error: error,
      p_retry_after: retryAfterSeconds === null ? null : `${retryAfterSeconds} seconds`,
    });
  },
};

// The scheduler's own secret (decision 0038), the same as Vault's outbox_scheduler_secret.
const schedulerSecret = Deno.env.get('OUTBOX_SCHEDULER_SECRET') ?? '';

/** Whether two texts are equal, in a time that does not depend on where they differ. */
function sameText(given: string, expected: string): boolean {
  const a = new TextEncoder().encode(given);
  const b = new TextEncoder().encode(expected);
  let difference = a.length ^ b.length;
  for (let at = 0; at < b.length; at += 1) difference |= (a[at] ?? 0) ^ (b[at] ?? 0);
  return difference === 0;
}

/**
 * The request handler for a function only the scheduler (pg_cron, with its secret) may run: an outbox consumer,
 * or the withdrawal payouts (#475). The function is deployed with verify_jwt off, as the scheduler carries no
 * person's token.
 */
export function serveScheduled(run: () => Promise<unknown>): (request: Request) => Promise<Response> {
  return async (request) => {
    if (request.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });
    if (schedulerSecret === '' || !sameText(request.headers.get('x-outbox-secret') ?? '', schedulerSecret)) {
      return Response.json({ error: 'Only the scheduler runs this' }, { status: 403 });
    }
    return Response.json(await run());
  };
}

/** The request handler for one outbox consumer. */
export function serveConsumer(consumer: Consumer): (request: Request) => Promise<Response> {
  return serveScheduled(() => runConsumer(outboxStore, consumer));
}
