// Purges a live venue (#432, decision 0239): the database's purge as the caller, who must be allowed it, then the venue's
// files in Storage, which no database row points at any more: its KYC photos and expense receipts. The database names
// the files only for a venue it has just purged.

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

// The console calls this from the browser.
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, apikey, content-type, x-client-info',
  'access-control-allow-methods': 'POST, OPTIONS',
};

function reply(body: object, status: number): Response {
  return Response.json(body, { status, headers: CORS });
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FILES_AT_ONCE = 100;

/** The venue, the name typed and whether only the files are asked for, from the request body, or null. */
async function askedFor(request: Request): Promise<{ venueId: string; venueName: string; filesOnly: boolean } | null> {
  const body: unknown = await request.json().catch(() => null);
  if (typeof body !== 'object' || body === null) return null;
  const venueId: unknown = Reflect.get(body, 'venueId');
  const venueName: unknown = Reflect.get(body, 'venueName');
  const filesOnly = Reflect.get(body, 'filesOnly') === true;
  return typeof venueId === 'string' && UUID.test(venueId) && typeof venueName === 'string' ? { venueId, venueName, filesOnly } : null;
}

/** Calls a database function with the given key: the caller's, or the service role's. */
function rpc(name: string, args: object, authorization: string): Promise<Response> {
  return fetch(`${supabaseUrl}/rest/v1/rpc/${name}`, {
    method: 'POST',
    headers: { apikey: anonKey, authorization, 'content-type': 'application/json' },
    body: JSON.stringify(args),
  });
}

/** Removes the venue's files, a bucket's batch at a time; gives how many went. */
async function removeFiles(venueId: string): Promise<number> {
  const listed = await rpc('purged_venue_files', { p_venue_id: venueId }, `Bearer ${serviceRoleKey}`);
  if (!listed.ok) throw new Error(`purged_venue_files: HTTP ${listed.status}`);
  const files: unknown = await listed.json();
  const byBucket = new Map<string, string[]>();
  for (const file of Array.isArray(files) ? files : []) {
    const bucket = String(Reflect.get(file, 'bucket_id'));
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), String(Reflect.get(file, 'name'))]);
  }
  let removed = 0;
  for (const [bucket, names] of byBucket) {
    for (let start = 0; start < names.length; start += FILES_AT_ONCE) {
      const prefixes = names.slice(start, start + FILES_AT_ONCE);
      const done = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
        method: 'DELETE',
        headers: { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' },
        body: JSON.stringify({ prefixes }),
      });
      if (!done.ok) throw new Error(`storage ${bucket}: HTTP ${done.status}`);
      removed += prefixes.length;
    }
  }
  return removed;
}

/** The venue's files, after its rows: how many went, or why not all did. */
async function filesAnswer(venueId: string, rows: number): Promise<Response> {
  try {
    return reply({ rows, files: await removeFiles(venueId) }, 200);
  } catch (error) {
    return reply({ rows, files: null, filesError: String(error) }, 200);
  }
}

/** The files again, for a venue already purged: only for someone the database lets run its purge's dry run. */
async function filesAgain(venueId: string, authorization: string): Promise<Response> {
  const allowed = await rpc('live_purge_preview', { p_venue_id: venueId }, authorization);
  return allowed.ok ? filesAnswer(venueId, 0) : reply({ code: 'not_allowed' }, 400);
}

/** The purge itself, as the caller, so the database decides whether they may; then the files. */
async function purge(venueId: string, venueName: string, authorization: string): Promise<Response> {
  const purged = await rpc('purge_live_venue', { p_venue_id: venueId, p_venue_name: venueName }, authorization);
  const body: unknown = await purged.json().catch(() => null);
  if (!purged.ok) {
    const code: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'code') : null;
    return reply({ code: typeof code === 'string' ? code : 'unavailable' }, 400);
  }
  const rows = (Array.isArray(body) ? body : []).reduce((total: number, row: unknown) => total + Number(Reflect.get(Object(row), 'deleted_rows') ?? 0), 0);
  // The rows are gone; a file left behind is removed by asking again with filesOnly.
  return filesAnswer(venueId, rows);
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
  const asked = await askedFor(request);
  if (asked === null) return reply({ error: 'venueId must be a uuid and venueName text' }, 400);
  const authorization = request.headers.get('authorization') ?? '';
  return asked.filesOnly ? filesAgain(asked.venueId, authorization) : purge(asked.venueId, asked.venueName, authorization);
});
