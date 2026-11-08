/**
 * `pnpm --filter @rivr/sim-180d staging:health`: read-only health of staging over the last 7 days (design 3d): outbox
 * deliveries stuck or failed, scheduled jobs that failed, and errors in the Edge Function and Auth logs. Uses the
 * Supabase CLI's own token file (never printed) and the Management API's read endpoints only.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { say } from '../src/log.ts';

const variables = z.array(z.object({ name: z.string(), value: z.string() }))
  .parse(JSON.parse(execFileSync('gh', ['variable', 'list', '--repo', 'adwate-ui/rivr-platform', '--json', 'name,value'], { encoding: 'utf8' })));
const ref = new URL(variables.find((each) => each.name === 'STAGING_SUPABASE_URL')?.value ?? 'https://x').hostname.split('.')[0] ?? '';
const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();
const out = process.argv.find((arg) => arg.startsWith('--out='))?.slice('--out='.length) ?? 'staging-health.json';

async function api(path: string, body?: object): Promise<unknown> {
  const answer = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!answer.ok) return { error: `${path} answered ${String(answer.status)}` };
  return answer.json();
}

const QUERIES: Readonly<Record<string, string>> = {
  outbox: `select consumer, status, count(*) as n, max(last_error) as last_error from public.outbox_delivery
           where created_at > now() - interval '7 days' group by 1, 2 order by 1, 2`,
  stuck: `select consumer, count(*) as n from public.outbox_delivery where status in ('pending', 'processing')
          and available_at < now() - interval '30 minutes' group by 1`,
  jobs: `select j.jobname, d.status, count(*) as n, max(left(d.return_message, 200)) as message from cron.job_run_details d
         join cron.job j on j.jobid = d.jobid where d.start_time > now() - interval '7 days' group by 1, 2 order by 1, 2`,
  inactiveJobs: `select jobname, schedule from cron.job where not active`,
};

const LOGS: Readonly<Record<string, string>> = {
  functions: `select timestamp, event_message, metadata.response.status_code as status, metadata.function_id as function
              from function_edge_logs cross join unnest(metadata) as metadata cross join unnest(metadata.response) as response
              where response.status_code >= 500 order by timestamp desc limit 50`,
  auth: `select timestamp, event_message from auth_logs where regexp_contains(event_message, '"level":"error"') order by timestamp desc limit 50`,
};

const result: Record<string, unknown> = {};
for (const [name, text] of Object.entries(QUERIES)) result[name] = await api('/database/query', { query: text });
const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
for (const [name, text] of Object.entries(LOGS)) {
  result[`logs.${name}`] = await api(`/analytics/endpoints/logs.all?iso_timestamp_start=${since}&sql=${encodeURIComponent(text)}`);
}
writeFileSync(out, `${JSON.stringify(result, null, 2)}\n`);
say(`staging health written to ${out}`);
