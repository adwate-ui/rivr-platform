#!/usr/bin/env node
/**
 * `pnpm supabase <cmd>`: the Supabase CLI, pointed at this worktree's own local stack.
 * `pnpm db:start`, `db:stop` and `db:reset` call this with start, stop and `db reset`.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { loadGoldenCases } from './lib/golden-cases.mjs';
import { hasNoMigrations, withJobsHeld } from './lib/jobs-held.mjs';
import { writeSupabaseConfig } from './lib/supabase-config.mjs';
import { localBinary, worktreeName, worktreeRoot } from '@rivr/config/worktree';

const root = worktreeRoot();
writeSupabaseConfig(root);
// An --env-file path names the same file wherever the CLI runs.
const args = process.argv.slice(2).map((arg, i, all) => {
  if (all[i - 1] === '--env-file') return resolve(root, arg);
  return arg.startsWith('--env-file=') ? `--env-file=${resolve(root, arg.slice('--env-file='.length))}` : arg;
});
/**
 * pgTAP counts broadcasts in realtime.messages, which the Realtime service splits into a table a day and makes only once it
 * has started: until today's exists, realtime.send drops every broadcast with a warning, and the tests that count them
 * (044, 074, 095, 296) read none (#885). Waits for it, a minute at most; the tests themselves may not make it.
 */
function waitForTodaysBroadcastTable() {
  const query = "select to_regclass('realtime.messages_' || to_char(now() at time zone 'utc', 'YYYY_MM_DD')) is not null";
  for (let second = 0; second < 60; second += 1) {
    const found = spawnSync('docker', ['exec', `supabase_db_${worktreeName(root)}`, 'psql', '-U', 'postgres', '-tAc', query], { encoding: 'utf8' });
    if (found.stdout?.trim() === 't') return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 1000);
  }
  process.stderr.write("Realtime has not made today's broadcast table: tests that count broadcasts may read none.\n");
}
// pgTAP proves the SQL twins of money rules against the golden files, which it cannot read itself.
if (args[0] === 'test' && args[1] === 'db') {
  loadGoldenCases(root);
  waitForTodaysBroadcastTable();
}
// `secrets` sets a hosted project's function secrets. Run in the worktree, the CLI also pushes the local
// [edge_runtime.secrets] (this checkout's own Send SMS hook secret, a 127.0.0.1 player address) over the
// project's, so every staging deploy left auth-send-code refusing Auth's signature (3 Nov). It runs in an
// empty directory with a config of its own instead: the CLI takes the first supabase/config.toml it finds
// going up, so without one it would push the secrets of a /tmp/supabase/config.toml anyone can write.
const remote = args.includes('secrets');
if (remote && (!args.some((arg) => arg.startsWith('--project-ref')) || args.some((arg) => arg.startsWith('--workdir')))) {
  process.stderr.write('supabase secrets: name the project with --project-ref, and give no --workdir.\n');
  process.exit(1);
}
const cwd = remote ? mkdtempSync(join(tmpdir(), 'supabase-secrets-')) : root;
if (remote) {
  mkdirSync(join(cwd, 'supabase'));
  writeFileSync(join(cwd, 'supabase/config.toml'), 'project_id = "secrets"\n');
}
// A local start or reset makes the database with migrations and seed off, and they are applied after it with pg_cron's
// jobs held (#1071). A reset to a version, of another database or with other seed files is left to the CLI.
const resetsLocally = args[0] === 'db' && args[1] === 'reset' && !args.some((arg) => /^--(linked|db-url|project-ref|version|last|sql-paths)/.test(arg));
const makesDatabase = args[0] === 'start' || resetsLocally;
const off = { SUPABASE_DB_MIGRATIONS_ENABLED: 'false', SUPABASE_DB_SEED_ENABLED: 'false' };
const result = spawnSync(localBinary('supabase', root), args, { stdio: 'inherit', cwd, env: makesDatabase ? { ...process.env, ...off } : process.env });
if (remote) rmSync(cwd, { recursive: true, force: true });
if (result.error) process.stderr.write(`supabase did not start: ${result.error.message}\n`);
let status = result.status ?? 1;
if (status === 0 && makesDatabase && (resetsLocally || hasNoMigrations())) {
  const push = ['db', 'push', '--local', '--include-all', ...(args.includes('--no-seed') ? [] : ['--include-seed']), '--yes'];
  status = withJobsHeld(() => spawnSync(localBinary('supabase', root), push, { stdio: 'inherit', cwd }).status ?? 1);
}
process.exit(status);
