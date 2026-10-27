// The cage agent's own door (#168, #123; decision 0260): a Node service on the cage computer, signed out, never a
// browser. It enrols once with the six-digit code staff read it from the Computers screen and the SHA-256 of a token
// it keeps (claim_agent, wrong codes counted by address); after that it sends the token itself as x-rivr-computer,
// and the database names its device and venue (agent_device) while it is not revoked. It may fetch its venue's newest
// offline pack, as a link good for five minutes. No browser may call this: there are no CORS headers, and JSON only.
import { cageAgentRequestSchema } from '@rivr/contracts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AS_SERVER = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };
// The pack's link is good this long: the agent downloads it at once.
const LINK_SECONDS = 300;

function field(value: unknown, name: string): unknown {
  return typeof value === 'object' && value !== null ? Reflect.get(value, name) : undefined;
}

/** Calls the database or Storage as the server; throws when it fails. */
async function call(path: string, body: object): Promise<unknown> {
  const answer = await fetch(`${supabaseUrl}${path}`, {
    method: 'POST', headers: AS_SERVER, body: JSON.stringify(body), signal: AbortSignal.timeout(5_000),
  });
  if (!answer.ok) throw new Error(`${path} failed (${answer.status})`);
  return await answer.json();
}

/** The first row a database function returned. */
async function rpc(name: string, args: object): Promise<unknown> {
  const rows = await call(`/rest/v1/rpc/${name}`, args);
  return Array.isArray(rows) ? rows[0] : undefined;
}

/** The caller's address, as private.request_ip reads it. */
function clientOf(request: Request): string {
  return request.headers.get('cf-connecting-ip') ?? (request.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() ?? '';
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Claims the code: the agent's device and venue, or 400 for a wrong code and 429 after too many. */
async function enrol(code: string, tokenHash: string, client: string): Promise<Response> {
  const row = await rpc('claim_agent', { p_code: code, p_token_hash: tokenHash, p_client: client });
  const refusal = field(row, 'refusal');
  if (typeof refusal === 'string') return Response.json({ error: refusal }, { status: refusal === 'too_many' ? 429 : 400 });
  return Response.json({ device_id: field(row, 'device_id'), venue_id: field(row, 'venue_id') });
}

/**
 * The venue's newest pack as a short-lived link, or 404 while none has been made. Its path only: the agent joins it to
 * the address it reached this function at, which this function cannot know (locally it sees the stack's own).
 */
async function pack(venueId: string): Promise<Response> {
  const objects = await call('/storage/v1/object/list/offline-packs', {
    prefix: `${venueId}/`, limit: 1, sortBy: { column: 'name', order: 'desc' },
  });
  const name = Array.isArray(objects) ? field(objects[0], 'name') : undefined;
  if (typeof name !== 'string') return Response.json({ error: 'none_yet' }, { status: 404 });
  const signed = await call(`/storage/v1/object/sign/offline-packs/${venueId}/${name}`, { expiresIn: LINK_SECONDS });
  return Response.json({ name, path: `/storage/v1${String(field(signed, 'signedURL'))}` });
}

/** The agent the request's token names: its venue, or null for none or a revoked one. */
async function agentVenue(request: Request): Promise<string | null> {
  const token = request.headers.get('x-rivr-computer') ?? '';
  if (token.length < 32) return null;
  const venueId = field(await rpc('agent_device', { p_token_hash: await sha256(token) }), 'venue_id');
  return typeof venueId === 'string' ? venueId : null;
}

Deno.serve(async (request) => {
  if (request.method !== 'POST') return Response.json({ error: 'POST only' }, { status: 405 });
  if (!(request.headers.get('content-type') ?? '').startsWith('application/json')) return Response.json({ error: 'invalid' }, { status: 415 });
  const input = cageAgentRequestSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ error: 'invalid' }, { status: 400 });
  try {
    if (input.data.action === 'enrol') return await enrol(input.data.code, input.data.token_hash, clientOf(request));
    const venueId = await agentVenue(request);
    if (venueId === null) return Response.json({ error: 'not_enrolled' }, { status: 401 });
    return await pack(venueId);
  } catch {
    return Response.json({ error: 'unavailable' }, { status: 502 });
  }
});
