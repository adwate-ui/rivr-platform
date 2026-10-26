// The KYC files of an erased member (#424; decision 0207). The console erases through the database itself, as
// erasing is admin-computer work that only the browser's own request may do (decision 0110); then it asks this to
// remove the member's folder in the private kyc bucket, kyc/<venue>/<member>/, with the service role, as no client
// may touch that bucket. The database names the folder, asked as the caller, only for a member already erased and
// a super admin of their venue (erased_member_kyc_folder), so this removes nothing else and tells no one else who
// was erased. Asked again, it removes what is left.
// Nothing reaches a system outside the project, practice venue or not.
import { erasedKycFilesSchema } from '@rivr/contracts';
import { CORS, reply, rpc } from '../kyc/server.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AS_SERVER = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };

// The body is a member id alone.
const MAX_BODY_BYTES = 1024;

function field(row: unknown, name: string): unknown {
  return typeof row === 'object' && row !== null ? Reflect.get(row, name) : null;
}

/** The names of the files in one folder of the kyc bucket; null when Storage would not say. */
async function namesIn(folder: string): Promise<string[] | null> {
  const listed = await fetch(`${supabaseUrl}/storage/v1/object/list/kyc`, {
    method: 'POST', headers: AS_SERVER, body: JSON.stringify({ prefix: folder, limit: 1000, offset: 0 }),
  });
  const entries: unknown = listed.ok ? await listed.json() : null;
  if (!Array.isArray(entries)) return null;
  return entries.map((entry) => field(entry, 'name')).filter((name): name is string => typeof name === 'string');
}

/** Removes the files in one folder of the kyc bucket and says how many Storage removed; null when it would not. */
async function removeFolder(folder: string): Promise<number | null> {
  const names = await namesIn(folder);
  if (names === null || names.length === 0) return names === null ? null : 0;
  const removed = await fetch(`${supabaseUrl}/storage/v1/object/kyc`, {
    method: 'DELETE', headers: AS_SERVER, body: JSON.stringify({ prefixes: names.map((name) => `${folder}${name}`) }),
  });
  const gone: unknown = removed.ok ? await removed.json() : null;
  return Array.isArray(gone) ? gone.length : null;
}

/** The erased member's folder from the database, asked as the caller, then its files gone, as the server. */
async function removeErasedFiles(token: string, body: unknown): Promise<Response> {
  const input = erasedKycFilesSchema.safeParse(body);
  if (!input.success) return reply({ error: 'invalid' }, 400);
  const folder = await rpc('erased_member_kyc_folder', { p_member_id: input.data.memberId }, token);
  if (typeof folder !== 'string') return reply({ error: 'not_erased' }, 409);
  const removed = await removeFolder(folder).catch(() => null);
  return removed === null ? reply({ error: 'files_left' }, 502) : reply({ filesRemoved: removed });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
  const length = request.headers.get('content-length');
  if (length === null || length === '' || !(Number(length) <= MAX_BODY_BYTES)) return reply({ error: 'Too large' }, 413);
  const token = request.headers.get('authorization') ?? '';
  if (token === '') return reply({ error: 'not_allowed' }, 403);
  try {
    return await removeErasedFiles(token, await request.json().catch(() => null));
  } catch {
    return reply({ error: 'unavailable' }, 502);
  }
});
