// Removes a purged venue's files (#432, decision 0239), when its super admin asks, within seven days of the purge. The
// purge itself runs from the console, as the caller, so the database checks the caller's computer. Asked as the caller
// here, the database names the files to remove: only those the venue's archive held, under the venue's own folders,
// that no row names any more. Storage removes them as the server, and the database is then told which went.
import { CORS, reply, rpc } from '../kyc/server.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AS_SERVER = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };

const MAX_BODY_BYTES = 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BUCKETS = ['kyc', 'expense-receipts'] as const;
const FILES_AT_ONCE = 100;
const REFUSED: Readonly<Record<string, number>> = { '42501': 403, RVRAT: 429, '22023': 409 };

/** A file the database named (<bucket>/<path>), as its bucket and path; null for another bucket or another venue's. */
function placeOf(file: string, venueId: string): { bucket: string; path: string } | null {
  const bucket = BUCKETS.find((name) => file.startsWith(`${name}/${venueId}/`));
  return bucket === undefined ? null : { bucket, path: file.slice(bucket.length + 1) };
}

/** Removes one bucket's files a hundred at a time; the ones Storage says went, as <bucket>/<path>. */
async function removeIn(bucket: string, paths: readonly string[]): Promise<string[]> {
  const removed: string[] = [];
  for (let at = 0; at < paths.length; at += FILES_AT_ONCE) {
    const answer = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
      method: 'DELETE', headers: AS_SERVER, body: JSON.stringify({ prefixes: paths.slice(at, at + FILES_AT_ONCE) }),
    }).catch(() => null);
    const gone: unknown = answer?.ok ? await answer.json().catch(() => null) : null;
    for (const entry of Array.isArray(gone) ? gone : []) {
      const name: unknown = typeof entry === 'object' && entry !== null ? Reflect.get(entry, 'name') : null;
      if (typeof name === 'string') removed.push(`${bucket}/${name}`);
    }
  }
  return removed;
}

/** The files the database says are due, removed; the database told which went and how many did not. */
async function removeFiles(token: string, venueId: string): Promise<Response> {
  const due: unknown = await rpc('purge_files_due', { p_venue_id: venueId }, token);
  const files = (Array.isArray(due) ? due : []).filter((file): file is string => typeof file === 'string');
  const placed = files.map((file) => placeOf(file, venueId)).filter((place) => place !== null);
  const removed = (await Promise.all(BUCKETS.map((bucket) => removeIn(bucket, placed.filter((place) => place.bucket === bucket).map((place) => place.path)))))
    .flat().filter((file) => files.includes(file));
  const left: unknown = await rpc('purge_files_done', { p_venue_id: venueId, p_removed: removed, p_failed: files.length - removed.length }, token);
  return reply({ removed: removed.length, left: typeof left === 'number' ? left : files.length - removed.length });
}

/** The venue asked for, from the request body, or null. */
async function venueOf(request: Request): Promise<string | null> {
  const body: unknown = await request.json().catch(() => null);
  const venueId: unknown = typeof body === 'object' && body !== null ? Reflect.get(body, 'venueId') : null;
  return typeof venueId === 'string' && UUID.test(venueId) ? venueId : null;
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
  const length = request.headers.get('content-length');
  if (length === null || length === '' || !(Number(length) <= MAX_BODY_BYTES)) return reply({ error: 'Too large' }, 413);
  const token = request.headers.get('authorization') ?? '';
  if (token === '') return reply({ code: '42501' }, 403);
  const venueId = await venueOf(request);
  if (venueId === null) return reply({ code: '22023' }, 400);
  try {
    return await removeFiles(token, venueId);
  } catch (error) {
    const code: unknown = typeof error === 'object' && error !== null ? Reflect.get(error, 'code') : null;
    return typeof code === 'string' && code in REFUSED ? reply({ code }, REFUSED[code]) : reply({ code: 'unavailable' }, 502);
  }
});
