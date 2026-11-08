/**
 * `pnpm --filter @rivr/sim-180d census -- --night=30 [--sizes=first] [--run=<id>]`: the screen census at one checkpoint.
 * Restores the checkpoint, plays the next night to 22:00, signs everyone in, visits every screen as every person at
 * every size, then writes the flags. The apps' preview servers start and stop inside the one Playwright run.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { say } from '../src/log.ts';
import { DB_ROOT, runDir, SIM_HOME } from '../src/paths.ts';
import { realPhotos } from './census-photos.ts';
import { buildApps, chooseContext, longerTokens, stageCheckpoint } from './census-prep.ts';
import { writeCensusReport } from './census-report.ts';
import { status } from './stack/supabase.ts';

const HERE = new URL('.', import.meta.url).pathname;
const flag = (name: string): string | undefined =>
  process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);

/** The newest run that has snapshots, unless one is named. */
function runId(): string {
  const named = flag('run');
  if (named !== undefined) return named;
  const runs = readdirSync(join(SIM_HOME, 'runs')).filter((name) => /^\d{12}$/.test(name)).sort();
  const latest = runs.at(-1);
  if (latest === undefined) throw new Error('no run yet: run `pnpm sim -- --reset --to=180` first');
  return latest;
}

const night = Number(flag('night') ?? 'NaN');
if (!Number.isInteger(night)) throw new Error('--night=<checkpoint> is needed: 0, 1, 7, 30, 47, 90 or 180');
const sizes = flag('sizes') === 'first' ? 'first' : 'all';
const repoRoot = join(HERE, '..', '..', '..');
const run = runDir(runId());
const checkpoint = `night-${String(night)}`;
const dir = join(run, 'census', checkpoint);
mkdirSync(join(dir, 'sessions'), { recursive: true });

longerTokens();
say(`census ${checkpoint}: restoring and playing to 22:00`);
stageCheckpoint(repoRoot, join(run, 'snapshots'), night);
say(`census ${checkpoint}: ${String(await realPhotos(repoRoot))} photos given a file`);
const context = chooseContext(checkpoint, dir, sizes);
writeFileSync(join(dir, 'context.json'), `${JSON.stringify(context, null, 2)}\n`);
say(`census ${checkpoint}: browser clock ${context.simNow}; building the apps if the key changed`);
// The apps read the stack's address and key when built and when served (defaultToLocalSupabase reads `supabase status` in
// the worktree): point the worktree's own, ignored config at the copy first, and pass both in the environment.
copyFileSync(join(DB_ROOT, 'supabase', 'config.toml'), join(repoRoot, 'supabase', 'config.toml'));
buildApps(repoRoot, dir);
const stack = status(repoRoot);
const result = spawnSync('pnpm', ['exec', 'playwright', 'test', '-c', 'census/playwright.config.ts', ...(flag('grep') ? ['--grep', flag('grep') ?? ''] : [])], {
  cwd: join(HERE, '..'),
  stdio: 'inherit',
  env: {
    ...process.env, CENSUS_CONTEXT: join(dir, 'context.json'), CENSUS_SIZES: sizes, CENSUS_OUT: join(dir, 'playwright'),
    VITE_SUPABASE_URL: stack.apiUrl, VITE_SUPABASE_PUBLISHABLE_KEY: stack.publishableKey,
    PUBLIC_SUPABASE_URL: stack.apiUrl, PUBLIC_SUPABASE_PUBLISHABLE_KEY: stack.publishableKey,
  },
});
say(`census ${checkpoint}: playwright exited ${String(result.status)}; report ${writeCensusReport(dir)}`);
