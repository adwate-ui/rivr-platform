/**
 * Which checkout this is, and its local port block. Four lanes and a reviewer run side by
 * side in separate worktrees, so each needs its own ports (CLAUDE.md, "Gotchas").
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

const BLOCK_BY_WORKTREE = {
  'rivr-platform': 543,
  'rivr-lane-a': 544,
  'rivr-lane-b': 545,
  'rivr-lane-c': 546,
  'rivr-lane-d': 547,
  'rivr-review': 548,
};

/** Absolute path of the current worktree's root. */
export function worktreeRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

/** The worktree folder name, used as the Supabase project_id: `rivr-lane-a`. */
export function worktreeName(root = worktreeRoot()) {
  return basename(root).replace(/[^a-z0-9-]/gi, '-').toLowerCase();
}

/**
 * The first three digits of every local port: 543 gives API 54321, database 54322.
 * RIVR_PORT_BLOCK, or a gitignored `.rivr-port-block` file, overrides the default when
 * another project already holds this worktree's ports.
 */
export function portBlock(root = worktreeRoot()) {
  const overrideFile = join(root, '.rivr-port-block');
  const override = process.env.RIVR_PORT_BLOCK ?? (existsSync(overrideFile) ? readFileSync(overrideFile, 'utf8').trim() : '');
  if (override) return Number(override);
  return BLOCK_BY_WORKTREE[basename(root)] ?? BLOCK_BY_WORKTREE['rivr-platform'];
}
