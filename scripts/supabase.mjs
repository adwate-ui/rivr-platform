#!/usr/bin/env node
/**
 * `pnpm supabase <cmd>`: the Supabase CLI, pointed at this worktree's own local stack.
 * `pnpm db:start`, `db:stop` and `db:reset` call this with start, stop and `db reset`.
 */
import { spawnSync } from 'node:child_process';
import { loadGoldenCases } from './lib/golden-cases.mjs';
import { writeSupabaseConfig } from './lib/supabase-config.mjs';
import { localBinary, worktreeRoot } from '@rivr/config/worktree';

const root = worktreeRoot();
writeSupabaseConfig(root);
const args = process.argv.slice(2);
// pgTAP proves the SQL twins of money rules against the golden files, which it cannot read itself.
if (args[0] === 'test' && args[1] === 'db') loadGoldenCases(root);
const result = spawnSync(localBinary('supabase', root), args, { stdio: 'inherit', cwd: root });
if (result.error) process.stderr.write(`supabase did not start: ${result.error.message}\n`);
process.exit(result.status ?? 1);
