#!/usr/bin/env node
/**
 * `pnpm supabase <cmd>`: the Supabase CLI, pointed at this worktree's own local stack.
 * `pnpm db:start`, `db:stop` and `db:reset` call this with start, stop and `db reset`.
 */
import { spawnSync } from 'node:child_process';
import { writeSupabaseConfig } from './lib/supabase-config.mjs';
import { worktreeRoot } from './lib/worktree.mjs';

const root = worktreeRoot();
writeSupabaseConfig(root);
const result = spawnSync('supabase', process.argv.slice(2), { stdio: 'inherit', cwd: root });
process.exit(result.status ?? 1);
