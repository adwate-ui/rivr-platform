// A reopened desk check's files (#931). A super admin reopens a verified check done in person through the database, which
// lists its face photo and two document photos to go; the console then asks this to remove them from the private kyc
// bucket with the service role, as no client may touch that bucket. The database names the files, asked as the caller,
// only for a super admin of the member's venue (reopened_kyc_files), so this removes nothing else; then they are forgotten.
// Asked again, it removes what is left. Nothing reaches a system outside the project.
import { reopenedKycFilesSchema } from '@rivr/contracts';
import { CORS, reply, rpc } from '../kyc/server.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AS_SERVER = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };

// The body is a member id alone.
const MAX_BODY_BYTES = 1024;

/** Removes the files from the kyc bucket; true once Storage has answered for all of them. */
async function remove(paths: readonly string[]): Promise<boolean> {
  if (paths.length === 0) return true;
  const removed = await fetch(`${supabaseUrl}/storage/v1/object/kyc`, { method: 'DELETE', headers: AS_SERVER, body: JSON.stringify({ prefixes: paths }) });
  return removed.ok;
}

/** The reopened check's files from the database, asked as the caller, then gone, as the server, then forgotten. */
async function removeReopenedFiles(token: string, body: unknown): Promise<Response> {
  const input = reopenedKycFilesSchema.safeParse(body);
  if (!input.success) return reply({ error: 'invalid' }, 400);
  const listed = await rpc('reopened_kyc_files', { p_member_id: input.data.memberId }, token).catch(() => null);
  if (!Array.isArray(listed)) return reply({ error: 'not_allowed' }, 403);
  const paths = listed.filter((path): path is string => typeof path === 'string');
  if (!(await remove(paths).catch(() => false))) return reply({ error: 'files_left' }, 502);
  await rpc('forget_reopened_kyc_files', { p_member_id: input.data.memberId, p_paths: paths }, token);
  return reply({ filesRemoved: paths.length });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (request.method !== 'POST') return reply({ error: 'POST only' }, 405);
  const length = request.headers.get('content-length');
  if (length === null || length === '' || !(Number(length) <= MAX_BODY_BYTES)) return reply({ error: 'Too large' }, 413);
  const token = request.headers.get('authorization') ?? '';
  if (token === '') return reply({ error: 'not_allowed' }, 403);
  try {
    return await removeReopenedFiles(token, await request.json().catch(() => null));
  } catch {
    return reply({ error: 'unavailable' }, 502);
  }
});
