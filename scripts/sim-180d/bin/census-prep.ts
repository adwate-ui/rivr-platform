/**
 * Readies a checkpoint for the census: its snapshot back on the stack with every service the apps need, the next night
 * played to 22:00 (so the room is full), the people who sign in chosen, and the apps built against the stack.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import type { CensusContext } from '../census/context.ts';
import { DB_ROOT } from '../src/paths.ts';
import { sql } from './stack/psql.ts';
import { restore } from './stack/snapshot.ts';
import { status } from './stack/supabase.ts';

// Auth's tokens run on real time; a long census would outlive the local hour. The copy's own config only.
const CENSUS_JWT_EXPIRY = 14_400;
// Two test numbers no seeded person holds: the two floor managers the simulation hired take them for the census.
const FLOOR_NUMBERS = { floor1: '9000000901', floor2: '9000000902' } as const;
const PLAY_TO_STEP = 24;
// Auth reads its token columns as text and fails a sign-in on a NULL ("Sign-in is down"); the logins the simulation
// made (floor managers, sign-ups, devices) keep them empty, as Auth's own rows do.
const EMPTY_TOKENS = `update auth.users set confirmation_token = coalesce(confirmation_token, ''), recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''), email_change = coalesce(email_change, ''),
  email_change_token_current = coalesce(email_change_token_current, ''), phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''), reauthentication_token = coalesce(reauthentication_token, '')`;


export function longerTokens(): void {
  const file = join(DB_ROOT, 'supabase', 'config.toml');
  const text = readFileSync(file, 'utf8');
  writeFileSync(file, text.replace(/^jwt_expiry = \d+$/m, `jwt_expiry = ${String(CENSUS_JWT_EXPIRY)}`));
}

/** The snapshot back, then (past night 0) the next night played to 22:00 without the message consumers. */
export function stageCheckpoint(repoRoot: string, snapshots: string, night: number): void {
  restore(repoRoot, 'ui', snapshots, `night-${String(night)}`);
  sql(EMPTY_TOKENS);
  if (night === 0) return;
  const next = night + 1;
  sql(`insert into sim.night (n, date, expected, peak, events) select ${String(next)}, date '2026-11-14' + ${String(next)}, 60, false, '{}'
       where not exists (select 1 from sim.night where n = ${String(next)})`);
  sql(`select sim.open_night(${String(next)})`);
  for (let step = 0; step <= PLAY_TO_STEP; step += 1) sql(`select sim.step(${String(next)}, ${String(step)})`);
}

const PEOPLE = `select json_build_object(
  'numbers', json_build_object(
    'super_admin', '9000000101', 'admin', '9000000103', 'cashier', '9000000104', 'dealer', '9000000106', 'marketing', '9000000107',
    'host', '9000000108', 'owner_view', '9000000109', 'service', '9000000790', 'floor', '${FLOOR_NUMBERS.floor1}',
    'member_seated', (select substr(p.phone, 4) from sim.persona p join sim.plan pl using (member_id)
      where pl.state = 'seated' and p.source = 'seed' and p.verified order by p.visits desc limit 1),
    'member_waiting', (select substr(p.phone, 4) from sim.persona p join sim.plan pl using (member_id)
      where pl.state in ('joined', 'arrived') and pl.entry_id is not null and p.source = 'seed' order by p.number limit 1),
    'member_unchecked', (select substr(p.phone, 4) from sim.persona p where p.source = 'seed' and not p.verified and not p.erased
      order by (select count(*) from sim.plan pl where pl.member_id = p.member_id) desc, p.number limit 1)),
  'dealer', (select full_name from sim.staff where key = 'dealer1'),
  'table', (select g.name from public.game_table g where g.venue_id = sim.venue() and g.is_open order by g.name limit 1),
  'slugs', coalesce((select json_agg(slug order by slug) from public.site_page where venue_id = sim.venue() and is_published), '[]'),
  'sourceKey', (select source_key from public.learn_source where venue_id = sim.venue() order by source_key limit 1),
  'simNow', to_char(sim_clock.now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))`;

const peopleSchema = z.object({
  numbers: z.record(z.string(), z.string().nullable()),
  dealer: z.string(),
  table: z.string().nullable(),
  slugs: z.array(z.string()),
  sourceKey: z.string().nullable(),
  simNow: z.string(),
});

/** The floor managers move to test numbers, as a super admin changes a number; Auth keeps it without the plus. */
function floorOnTestNumbers(): void {
  for (const [key, number] of Object.entries(FLOOR_NUMBERS)) {
    sql(`update public.staff set phone = '+91${number}' where id = (select staff_id from sim.staff where key = '${key}');
         update auth.users set phone = '91${number}' where id = sim.who('${key}')`);
  }
}

/** The member's latest session as their phone lists it (my_sessions), for /sessions/$sessionId. */
function sessionOf(number: string): string | null {
  const id = sql(`select sim.val(sim.try((select user_id from sim.persona where phone = '+91${number}'), 'census.read_sessions',
    'select session_id from public.my_sessions() order by opened_at desc limit 1'))`).trim();
  return id === '' ? null : id;
}

export function chooseContext(checkpoint: string, dir: string, sizes: CensusContext['sizes']): CensusContext & { slugs: string[] } {
  floorOnTestNumbers();
  const people = peopleSchema.parse(JSON.parse(sql(PEOPLE)));
  const numbers = Object.fromEntries(Object.entries(people.numbers).filter((entry): entry is [string, string] => entry[1] !== null));
  const session = numbers['member_seated'] === undefined ? null : sessionOf(numbers['member_seated']);
  const params: Record<string, string> = {};
  if (session !== null) params['sessionId'] = session;
  if (people.sourceKey !== null) params['sourceKey'] = people.sourceKey;
  if (people.slugs[0] !== undefined) params['slug'] = people.slugs[0];
  return { checkpoint, simNow: people.simNow, dir, sizes, numbers, dealer: people.dealer, table: people.table ?? 'Table 1', params, slugs: people.slugs };
}

/** Builds the five apps against the stack once per publishable key (the turbo cache does not key on it). */
export function buildApps(repoRoot: string, dir: string): void {
  const stack = status(repoRoot);
  const marker = join(dir, '..', 'built-for');
  if (existsSync(marker) && readFileSync(marker, 'utf8') === stack.publishableKey) return;
  execFileSync('node', ['scripts/turbo.mjs', 'run', 'build', '--filter', './apps/*', '--force', '--output-logs=errors-only'], {
    cwd: repoRoot,
    stdio: 'inherit',
    env: { ...process.env, VITE_SUPABASE_URL: stack.apiUrl, VITE_SUPABASE_PUBLISHABLE_KEY: stack.publishableKey,
      PUBLIC_SUPABASE_URL: stack.apiUrl, PUBLIC_SUPABASE_PUBLISHABLE_KEY: stack.publishableKey },
  });
  mkdirSync(join(dir, '..'), { recursive: true });
  writeFileSync(marker, stack.publishableKey);
}
