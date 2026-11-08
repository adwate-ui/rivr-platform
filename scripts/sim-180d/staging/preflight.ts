/**
 * `pnpm --filter @rivr/sim-180d staging:preflight`: read-only checks before the staging walks (design 3d). It changes
 * nothing, prints no secret (the Supabase CLI's own token file is read, never shown; the allowlist is compared by
 * digest), and exits non-zero while any precondition fails.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';
import { say } from '../src/log.ts';
import { REPO_ROOT } from '../src/paths.ts';
import { allowlistCheck, numbersNamed, testNumbers, type Check } from '../src/staging/preflight.ts';

const REPO = 'adwate-ui/rivr-platform';
const LIVE_VENUE = '00000000-0000-4000-8000-000000000001';
const APPS = ['PLAYER', 'CONSOLE', 'TABLET', 'DISPLAY', 'WEB'] as const;

const variables = z.array(z.object({ name: z.string(), value: z.string() }))
  .parse(JSON.parse(execFileSync('gh', ['variable', 'list', '--repo', REPO, '--json', 'name,value'], { encoding: 'utf8' })));
const variable = (name: string): string => variables.find((each) => each.name === name)?.value ?? '';
const ref = new URL(variable('STAGING_SUPABASE_URL')).hostname.split('.')[0] ?? '';
const token = readFileSync(join(homedir(), '.supabase', 'access-token'), 'utf8').trim();

async function managementApi(path: string, body?: object): Promise<unknown> {
  const answer = await fetch(`https://api.supabase.com/v1/projects/${ref}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!answer.ok) throw new Error(`Management API ${path} answered ${String(answer.status)}`);
  return answer.json();
}

/** Read-only SQL on staging (the Management API's query endpoint). */
const query = async (text: string): Promise<unknown> => managementApi('/database/query', { query: text });

async function appsAnswer(): Promise<Check[]> {
  return Promise.all(APPS.map(async (app) => {
    const url = variable(`STAGING_${app}_URL`);
    const status = await fetch(url).then((answer) => answer.status).catch(() => 0);
    return { check: `${app.toLowerCase()} app`, ok: status === 200, detail: `${url} answered ${String(status)}` };
  }));
}

function stagingFlowNumbers(): Set<string> {
  const dir = join(REPO_ROOT, 'e2e', 'flows');
  const files = readdirSync(dir).filter((name) => readFileSync(join(dir, name), 'utf8').includes('@staging'));
  return new Set(files.flatMap((name) => numbersNamed(readFileSync(join(dir, name), 'utf8'))));
}

async function numbersChecks(): Promise<{ checks: Check[]; free: string[] }> {
  const auth = z.object({ sms_test_otp: z.string().nullable() }).parse(await managementApi('/config/auth'));
  const code = process.env['STAGING_TEST_OTP'] ?? '';
  const { numbers, withCode } = testNumbers(auth.sms_test_otp ?? '', code);
  const used = stagingFlowNumbers();
  const free = numbers.filter((number) => !used.has(number));
  return {
    free,
    checks: [
      { check: 'test numbers', ok: numbers.length > 0 && code !== '' && withCode === numbers.length, detail: `${String(numbers.length)} on staging, ${String(withCode)} take STAGING_TEST_OTP` },
      { check: 'numbers no @staging flow uses', ok: free.length >= 10, detail: `${String(free.length)} free` },
    ],
  };
}

async function allowlist(): Promise<Check> {
  const rows = z.array(z.object({ alert_whatsapp: z.string().nullable() }))
    .parse(await query(`select alert_whatsapp from public.venue_config where venue_id = '${LIVE_VENUE}'`));
  const last4 = process.env['OWNER_LAST4'] ?? '';
  const mine = /^\d{4}$/.test(last4)
    ? z.array(z.object({ phone: z.string() })).parse(await query(`select phone from public.member where phone like '%${last4}' and erased_at is null`))
    : [];
  const owner = process.env['OWNER_WHATSAPP'] || (mine.length === 1 ? mine[0]?.phone : undefined) || rows[0]?.alert_whatsapp || '';
  const secrets = z.array(z.object({ name: z.string(), value: z.string() }))
    .parse(JSON.parse(execFileSync(join(REPO_ROOT, 'node_modules', '.bin', 'supabase'), ['secrets', 'list', '--project-ref', ref, '-o', 'json'], { encoding: 'utf8' })));
  const check = allowlistCheck(secrets, owner);
  return { ...check, detail: `${check.detail} (owner’s number ends ${owner.slice(-4)})` };
}

const numbers = await numbersChecks();
const checks = [...(await appsAnswer()), ...numbers.checks, await allowlist()];
for (const check of checks) say(`${check.ok ? 'pass' : 'FAIL'}  ${check.check}: ${check.detail}`);
say(`free test numbers: ${numbers.free.join(' ')}`);
if (checks.some((check) => !check.ok)) process.exit(1);
