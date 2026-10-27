// The recorder's playback link for the camera that saw a hand, a cage transaction or an incident (#122, decision 0238).
// Staff call it with their own session. The database answers only for a row they may read (public.cctv_reference);
// the recorder adapter makes the link. The practice venue always gets the fake recorder, and a real venue gets the
// recorder at CCTV_PLAYBACK_URL once it is set (until then the fake, whose links never resolve).
import { createAdapters, createFakeCctv, createTemplateCctv, isRecorderTemplate } from '@rivr/adapters';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
// The recorder's playback address with {channel} and one of {utc}, {ist} or {epoch} (docs/runbooks/ci-and-release.md).
const recorderTemplate = Deno.env.get('CCTV_PLAYBACK_URL') ?? '';

// The console calls this from the browser.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function reply(body: object, status: number): Response {
  return Response.json(body, { status, headers: CORS });
}

const KINDS = new Set(['hand', 'cage_transaction', 'incident']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** What the link is for, from the request body, or null unless it is one of the three kinds and an id. */
async function askedFor(request: Request): Promise<{ kind: string; id: string } | null> {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== 'object' || body === null) return null;
  const kind: unknown = Reflect.get(body, 'kind');
  const id: unknown = Reflect.get(body, 'id');
  return typeof kind === 'string' && KINDS.has(kind) && typeof id === 'string' && UUID.test(id) ? { kind, id } : null;
}

function recorderFor(isPractice: boolean) {
  if (isPractice) return createFakeCctv();
  const live = isRecorderTemplate(recorderTemplate) ? createTemplateCctv({ template: recorderTemplate }) : undefined;
  return createAdapters({ isPracticeVenue: false, live: { cctv: live } }).cctv;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
  const asked = await askedFor(request);
  if (asked === null) return reply({ error: 'kind must be hand, cage_transaction or incident, and id a uuid' }, 400);

  // Asked as the caller, so the database answers only for a row they may read.
  const found = await fetch(`${supabaseUrl}/rest/v1/rpc/cctv_reference`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization: request.headers.get('authorization') ?? '', 'content-type': 'application/json' },
    body: JSON.stringify({ p_kind: asked.kind, p_id: asked.id }),
  });
  // A refusal comes back as no rows (no_camera); an error here is the database not answering.
  if (!found.ok) return reply({ error: 'unavailable' }, 502);
  const rows: unknown = await found.json();
  const row: unknown = Array.isArray(rows) ? rows[0] : undefined;
  if (typeof row !== 'object' || row === null) return reply({ error: 'no_camera' }, 404);

  // Fail closed: only a venue the database says is not the practice one gets the real recorder.
  const link = await recorderFor(Reflect.get(row, 'is_practice') !== false).playbackLink({
    cameraId: String(Reflect.get(row, 'channel')),
    at: new Date(String(Reflect.get(row, 'at'))),
  });
  return link.ok
    ? reply({ url: link.value.url, camera: String(Reflect.get(row, 'camera_name')) }, 200)
    : reply({ error: link.error.code }, 502);
});
