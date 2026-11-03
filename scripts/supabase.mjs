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
import { writeSupabaseConfig } from './lib/supabase-config.mjs';
import { localBinary, worktreeRoot } from '@rivr/config/worktree';

const root = worktreeRoot();
writeSupabaseConfig(root);
// An --env-file path names the same file wherever the CLI runs.
const args = process.argv.slice(2).map((arg, i, all) => {
  if (all[i - 1] === '--env-file') return resolve(root, arg);
  return arg.startsWith('--env-file=') ? `--env-file=${resolve(root, arg.slice('--env-file='.length))}` : arg;
});
// pgTAP proves the SQL twins of money rules against the golden files, which it cannot read itself.
if (args[0] === 'test' && args[1] === 'db') loadGoldenCases(root);
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
const result = spawnSync(localBinary('supabase', root), args, { stdio: 'inherit', cwd });
if (remote) rmSync(cwd, { recursive: true, force: true });
if (result.error) process.stderr.write(`supabase did not start: ${result.error.message}\n`);
process.exit(result.status ?? 1);
