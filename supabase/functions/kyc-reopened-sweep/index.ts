// The retry for a reopened desk check's files (#931). A reopening lists its face photo and two document photos to go, and the
// console asks kyc-reopened-files to remove them at once; a file Storage did not remove stays listed. pg_cron runs this every
// five minutes with the scheduler's secret (decision 0038): it removes from the private kyc bucket, with the service role, the
// files still listed ten minutes after their reopening, a hundred at most, then has them forgotten. The database names them,
// each in its member's own folder and none of a frozen venue or member, so this removes nothing else. It logs nothing and
// answers with counts alone. Nothing reaches a system outside the project.
import { rpc, serveScheduled } from '../_shared/outbox.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const AS_SERVER = { apikey: serviceRoleKey, authorization: `Bearer ${serviceRoleKey}`, 'content-type': 'application/json' };

/** Removes the files from the kyc bucket; true once Storage has answered for all of them. */
async function remove(paths: readonly string[]): Promise<boolean> {
  const removed = await fetch(`${supabaseUrl}/storage/v1/object/kyc`, {
    method: 'DELETE', headers: AS_SERVER, body: JSON.stringify({ prefixes: paths }), signal: AbortSignal.timeout(10_000),
  });
  return removed.ok;
}

/** One run: the files still listed, gone from Storage, then forgotten; those Storage kept wait for the next run. */
async function sweep(): Promise<{ filesRemoved: number; filesLeft: number }> {
  const listed = await rpc('reopened_kyc_files_to_sweep', {});
  const paths = Array.isArray(listed) ? listed.filter((path): path is string => typeof path === 'string') : [];
  if (paths.length === 0) return { filesRemoved: 0, filesLeft: 0 };
  if (!(await remove(paths).catch(() => false))) return { filesRemoved: 0, filesLeft: paths.length };
  // The database forgets only the paths Storage no longer holds; one it kept stays listed for the next run.
  const forgotten = Number(await rpc('forget_swept_kyc_files', { p_paths: paths }));
  return { filesRemoved: forgotten, filesLeft: paths.length - forgotten };
}

Deno.serve(serveScheduled(sweep));
