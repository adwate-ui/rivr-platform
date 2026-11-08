import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import type { ServiceSet } from '../../src/cli/args.ts';
import { DB_ROOT } from '../../src/paths.ts';
import { parseStatus, type StackStatus } from '../../src/stack/status.ts';

// The nights need only Postgres, Auth and the API: message consumers run in Node, and no browser is open.
const SIM_EXCLUDES = ['studio', 'imgproxy', 'mailpit', 'logflare', 'vector', 'edge-runtime', 'realtime', 'supavisor', 'postgres-meta'];
// The census and the walks need realtime (live counts, the chime), storage (photos) and edge functions (device-pair).
const UI_EXCLUDES = ['studio', 'mailpit', 'logflare', 'vector', 'supavisor', 'postgres-meta'];

/** The Supabase CLI installed in the harness worktree, run inside the copy so it reads the copy's config. */
function cli(repoRoot: string, args: readonly string[]): string {
  return execFileSync(join(repoRoot, 'node_modules', '.bin', 'supabase'), args, {
    cwd: DB_ROOT,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'inherit'],
  });
}

export function start(repoRoot: string, set: ServiceSet): void {
  cli(repoRoot, ['start', '-x', (set === 'sim' ? SIM_EXCLUDES : UI_EXCLUDES).join(',')]);
}

export function stop(repoRoot: string): void {
  cli(repoRoot, ['stop']);
}

/** Reapplies every migration and the seed. The clock migration runs first, so the clock starts again too. */
export function reset(repoRoot: string): void {
  cli(repoRoot, ['db', 'reset']);
}

export function status(repoRoot: string): StackStatus {
  return parseStatus(cli(repoRoot, ['status', '-o', 'json']));
}
