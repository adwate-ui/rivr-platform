/**
 * `pnpm --filter @rivr/sim-180d walks -- --night=30 [--grep=<flow>]`: every e2e flow and the harness's own walks on a
 * checkpoint night, played to 22:00, with the browser on the simulation's clock. Writes walks.md: each walk, finished
 * or not, with the first line of why not. A walk that cannot finish is a finding, never skipped.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { say } from '../src/log.ts';
import { DB_ROOT, runDir, SIM_HOME } from '../src/paths.ts';
import { buildApps, longerTokens, stageCheckpoint } from './census-prep.ts';
import { sql } from './stack/psql.ts';

const HERE = new URL('.', import.meta.url).pathname;
const flag = (name: string): string | undefined => process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
const latestRun = (): string => readdirSync(join(SIM_HOME, 'runs')).filter((name) => /^\d{12}$/.test(name)).sort().at(-1) ?? '';

const resultSchema = z.object({
  suites: z.array(z.lazy((): z.ZodType<Suite> => suiteSchema)),
});
interface Spec { title: string; file: string; tests: { projectName: string; results: { status: string; error?: { message?: string | undefined } | undefined }[] }[] }
interface Suite { title: string; file?: string | undefined; specs?: Spec[] | undefined; suites?: Suite[] | undefined }
const specSchema: z.ZodType<Spec> = z.object({
  title: z.string(), file: z.string(),
  tests: z.array(z.object({ projectName: z.string(), results: z.array(z.object({ status: z.string(), error: z.object({ message: z.string().optional() }).optional() })) })),
});
const suiteSchema: z.ZodType<Suite> = z.object({
  title: z.string(), file: z.string().optional(), specs: z.array(specSchema).optional(), suites: z.array(z.lazy(() => suiteSchema)).optional(),
});

function specsOf(suite: Suite): Spec[] {
  return [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(specsOf)];
}

// Playwright's error messages carry terminal colours.
const COLOUR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');
const plain = (text: string): string => text.replaceAll(COLOUR, '');

function writeSummary(out: string, night: number): string {
  const results = resultSchema.parse(JSON.parse(readFileSync(join(out, 'results.json'), 'utf8')));
  const rows = results.suites.flatMap(specsOf).flatMap((spec) => spec.tests.map((each) => {
    const last = each.results.at(-1);
    const why = plain(last?.error?.message ?? '').split('\n').find((line) => line.trim() !== '') ?? '';
    return `| ${each.projectName} | ${spec.file} | ${spec.title.replaceAll('|', '/')} | ${last?.status ?? 'not run'} | ${why.replaceAll('|', '/').slice(0, 200)} |`;
  }));
  const finished = rows.filter((row) => row.includes('| passed |')).length;
  const file = join(out, 'walks.md');
  writeFileSync(file, [`# Walks on night ${String(night + 1)} at 22:00`, '', `${String(finished)} of ${String(rows.length)} finished.`, '',
    '| Project | File | Walk | Result | Why not |', '| --- | --- | --- | --- | --- |', ...rows, ''].join('\n'));
  return file;
}

const night = Number(flag('night') ?? '30');
const repoRoot = join(HERE, '..', '..', '..');
const run = runDir(flag('run') ?? latestRun());
const out = join(run, 'walks', `night-${String(night)}`);
mkdirSync(out, { recursive: true });
longerTokens();
stageCheckpoint(repoRoot, join(run, 'snapshots'), night);
// e2e/support/serviceRole.ts reads `supabase status` in the worktree: point the worktree's own (ignored) config at the copy.
copyFileSync(join(DB_ROOT, 'supabase', 'config.toml'), join(repoRoot, 'supabase', 'config.toml'));
buildApps(repoRoot, join(run, 'census', 'walks'));
const simNow = sql(`select to_char(sim_clock.now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"')`).trim();
say(`walks on night ${String(night + 1)}: browser clock ${simNow}`);
const grep = flag('grep');
const result = spawnSync('pnpm', ['exec', 'playwright', 'test', '-c', 'walks/playwright.config.ts', '--tsconfig', 'walks/tsconfig.json', ...(grep ? ['--grep', grep] : [])], {
  cwd: join(HERE, '..'),
  stdio: 'inherit',
  env: { ...process.env, WALK_SIM_NOW: simNow, WALKS_OUT: out },
});
say(`walks: playwright exited ${String(result.status)}; summary ${writeSummary(out, night)}`);
