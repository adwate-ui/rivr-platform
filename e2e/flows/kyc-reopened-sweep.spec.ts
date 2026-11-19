/**
 * A reopened desk check's files that Storage kept are swept (#931): the scheduler runs kyc-reopened-sweep with its secret,
 * which removes from the kyc bucket the files still listed ten minutes after their reopening and forgets them; a file
 * listed a minute ago waits, and nobody without the secret runs it. Local stack only: it uploads with the service role,
 * lists the files in the database as a reopening would, and reads this checkout's scheduler secret.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import { localSupabaseEnv, worktreeRoot } from '@rivr/config/worktree';
import { isRemoteTarget } from '../support/apps.ts';
import { CLUB, sql } from '../support/highHand.ts';
import { serviceRoleKey } from '../support/serviceRole.ts';

// Nobody's member id: the flow's files sit in a folder of their own.
const MEMBER = '00000000-0000-4000-8000-0000000002f9';
const KEPT = `${CLUB}/${MEMBER}/in-person-e2e-kept.png`;
const WAITING = `${CLUB}/${MEMBER}/doc-pan-e2e-waiting.png`;
// A one-pixel PNG.
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');

/** This checkout's scheduler secret, which scripts/lib/supabase-config.mjs gave the local functions. */
function schedulerSecret(): string {
  return readFileSync(join(worktreeRoot(), 'supabase/.scheduler-secret'), 'utf8').trim();
}

function filesNamed(path: string): string {
  return sql(`select count(*) from storage.objects where bucket_id = 'kyc' and name = '${path}'`);
}

test.describe('Reopened check files sweep', () => {
  test.skip(isRemoteTarget(), 'uploads with the service role and reads the local scheduler secret, so the local stack only');

  test('the scheduler removes the files of a reopened check Storage kept ten minutes on, and nobody else runs it', async ({ request }) => {
    const { url } = localSupabaseEnv();
    const service = serviceRoleKey();
    const asServer = { apikey: service, authorization: `Bearer ${service}` };
    for (const path of [KEPT, WAITING]) {
      const uploaded = await request.post(`${url}/storage/v1/object/kyc/${path}`, { headers: { ...asServer, 'content-type': 'image/png', 'x-upsert': 'true' }, data: PNG });
      expect(uploaded.ok()).toBe(true);
    }
    sql(`insert into private.kyc_reopened_file (path, venue_id, member_id, reopened_at)
         values ('${KEPT}', '${CLUB}', '${MEMBER}', now() - interval '11 minutes'), ('${WAITING}', '${CLUB}', '${MEMBER}', now() - interval '1 minute')
         on conflict (path) do update set reopened_at = excluded.reopened_at`);
    const sweep = (secret: string) =>
      request.post(`${url}/functions/v1/kyc-reopened-sweep`, { headers: { 'x-outbox-secret': secret, 'content-type': 'application/json' }, data: {} });

    expect((await sweep('not-the-scheduler')).status()).toBe(403);
    expect(filesNamed(KEPT)).toBe('1');

    const swept = await sweep(schedulerSecret());
    expect(swept.status()).toBe(200);
    expect(Number(Reflect.get(await swept.json(), 'filesRemoved'))).toBeGreaterThanOrEqual(1);
    expect(filesNamed(KEPT)).toBe('0');
    // The file listed a minute ago stays, and stays listed, for a later run.
    expect(filesNamed(WAITING)).toBe('1');
    expect(sql(`select string_agg(path, ',') from private.kyc_reopened_file where member_id = '${MEMBER}'`)).toBe(WAITING);

    sql(`delete from private.kyc_reopened_file where member_id = '${MEMBER}'`);
    await request.delete(`${url}/storage/v1/object/kyc`, { headers: { ...asServer, 'content-type': 'application/json' }, data: { prefixes: [WAITING] } });
  });
});
