// @ts-check
/**
 * Which checkout this is, its local port block, and its local Supabase stack. Four lanes and a
 * reviewer run side by side in separate worktrees, so each needs its own ports (CLAUDE.md,
 * "Gotchas"; docs/decisions/0003-worktree-port-blocks.md). Used by the root scripts and by every
 * app's vite.config.ts.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';

/** @type {Record<string, number>} */
const BLOCK_BY_WORKTREE = {
  'rivr-platform': 543,
  'rivr-lane-a': 544,
  'rivr-lane-b': 545,
  'rivr-lane-c': 546,
  'rivr-lane-d': 547,
  'rivr-review': 548,
};

/** Each app's dev and preview server: port block * 100 + this. */
const APP_PORT_OFFSET = { player: 40, console: 41, tablet: 42, display: 43, driver: 44, web: 45 };

/** Absolute path of the current worktree's root. */
export function worktreeRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

/** Path of a dev-dependency CLI installed in this worktree, so scripts work with or without `pnpm`. */
export function localBinary(/** @type {string} */ name, root = worktreeRoot()) {
  return join(root, 'node_modules', '.bin', name);
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
  return BLOCK_BY_WORKTREE[basename(root)] ?? 543;
}

/** The port an app serves on in this worktree: player 54340 in the root checkout. */
export function appPort(/** @type {keyof typeof APP_PORT_OFFSET} */ app, root = worktreeRoot()) {
  return portBlock(root) * 100 + APP_PORT_OFFSET[app];
}

/**
 * The local Supabase stack's API URL and publishable key, for apps in development. Falls back
 * to the expected URL and an empty key when the stack is not running (the app then shows its
 * error state). Never returns the service-role key.
 */
export function localSupabaseEnv(root = worktreeRoot()) {
  const fallback = { url: `http://127.0.0.1:${portBlock(root)}21`, publishableKey: '' };
  try {
    const status = JSON.parse(
      execFileSync(localBinary('supabase', root), ['status', '-o', 'json'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }),
    );
    return { url: String(status.API_URL ?? fallback.url), publishableKey: String(status.PUBLISHABLE_KEY ?? '') };
  } catch {
    return fallback;
  }
}
