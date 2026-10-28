// The social inbox (#156; decision 0268): Meta's webhook for Instagram, Facebook and WhatsApp messages. A request is
// read only once its signature is the app secret's (META_APP_SECRET); its text messages become leads for the club
// (SOCIAL_VENUE_ID; the database refuses the practice venue), a WhatsApp lead linked to the member with that number.
// Meta's subscription check (GET) is answered with its challenge for the verify token (META_VERIFY_TOKEN). Until all
// three are set it answers 503.
import { inboxMessagesFrom, isMetaSignature } from '@rivr/adapters/social-inbox';
import { rpc } from '../_shared/outbox.ts';

const appSecret = Deno.env.get('META_APP_SECRET') ?? '';
const verifyToken = Deno.env.get('META_VERIFY_TOKEN') ?? '';
const venueId = Deno.env.get('SOCIAL_VENUE_ID') ?? '';

/** Meta's subscription check: the challenge back, for the right verify token. */
function subscribe(request: Request): Response {
  const query = new URL(request.url).searchParams;
  const isOurs = query.get('hub.mode') === 'subscribe' && query.get('hub.verify_token') === verifyToken;
  return isOurs ? new Response(query.get('hub.challenge') ?? '') : new Response('Forbidden', { status: 403 });
}

/** A delivery: checked, read, and its messages recorded. A failure to record answers 500, so Meta sends it again. */
async function deliver(request: Request): Promise<Response> {
  const body = await request.text();
  if (!(await isMetaSignature(body, request.headers.get('x-hub-signature-256'), appSecret))) return new Response('Bad signature', { status: 401 });
  let payload: unknown;
  try {
    payload = JSON.parse(body);
  } catch {
    return new Response('Not JSON', { status: 400 });
  }
  const messages = inboxMessagesFrom(payload).map((message) => ({
    id: message.id, channel: message.channel, thread_id: message.threadId, handle: message.fromHandle, text: message.text,
    received_at: message.receivedAt.toISOString(),
  }));
  if (messages.length > 0) await rpc('record_inbox_messages', { p_venue_id: venueId, p_messages: messages });
  return Response.json({ received: messages.length });
}

Deno.serve(
  appSecret && verifyToken && venueId
    ? (request) => (request.method === 'GET' ? subscribe(request) : request.method === 'POST' ? deliver(request) : new Response('GET or POST', { status: 405 }))
    : () => Response.json({ error: 'The social inbox is not configured' }, { status: 503 }),
);
