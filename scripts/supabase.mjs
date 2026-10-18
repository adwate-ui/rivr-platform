#!/usr/bin/env node
/**
 * `pnpm supabase <cmd>`: the Supabase CLI, pointed at this worktree's own local stack.
 * `pnpm db:start`, `db:stop` and `db:reset` call this with start, stop and `db reset`.
 */
import { spawnSync } from 'node:child_process';
import { writeSupabaseConfig } from './lib/supabase-config.mjs';
import { localBinary, worktreeRoot } from '@rivr/config/worktree';

const root = worktreeRoot();
writeSupabaseConfig(root);
const result = spawnSync(localBinary('supabase', root), process.argv.slice(2), { stdio: 'inherit', cwd: root });
if (result.error) process.stderr.write(`supabase did not start: ${result.error.message}\n`);
process.exit(result.status ?? 1);
