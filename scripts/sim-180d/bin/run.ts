/** `pnpm --filter @rivr/sim-180d sim -- …`: prepare the copy, start or stop its stack, load the club, run nights. */
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { readCatalogue } from '../src/catalogue/catalogue.ts';
import { parseArgs, type ServiceSet } from '../src/cli/args.ts';
import { say } from '../src/log.ts';
import { runDir } from '../src/paths.ts';
import { latestRun, loadClub, runIdOf } from './club.ts';
import { runNights } from './nights.ts';
import { writeReport } from './report.ts';
import { sql } from './stack/psql.ts';
import { prepare } from './stack/prepare.ts';
import { restore, snapshot } from './stack/snapshot.ts';
import { reset, start, stop } from './stack/supabase.ts';

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const args = parseArgs(process.argv.slice(2));
const rev = (ref: string): string => execFileSync('git', ['-C', repoRoot, 'rev-parse', '--short=8', ref], { encoding: 'utf8' }).trim();

/** A fresh club: every migration and the seed again, the sim schema and night 0, and night 0's snapshot. */
async function freshClub(set: ServiceSet): Promise<void> {
  reset(repoRoot);
  const id = new Date().toISOString().slice(0, 16).replaceAll(/[-:T]/g, '');
  loadClub(await readCatalogue(), { id, main: rev('origin/main'), harness: rev('HEAD') });
  say(`run ${id}: night 0 loaded`);
  snapshot(repoRoot, set, join(runDir(id), 'snapshots'), 'night-0');
}

if (args.stop) {
  stop(repoRoot);
} else {
  const set = args.start ?? 'sim';
  if (args.prepare) await prepare(repoRoot);
  if (args.start !== null) start(repoRoot, args.start);
  if (args.reset) await freshClub(set);
  if (args.from !== null) {
    restore(repoRoot, set, join(runDir(latestRun()), 'snapshots'), `night-${String(args.from)}`);
    say(`carrying on from night ${String(args.from)} of run ${runIdOf()}`);
  }
  if (args.to !== null) {
    const started = Date.now();
    await runNights(repoRoot, args.to, set);
    say(`report: ${writeReport(runDir(runIdOf()), (Date.now() - started) / 1000)}`);
  }
  say(`clock: ${sql('select sim_clock.now()').trim()}`);
}
