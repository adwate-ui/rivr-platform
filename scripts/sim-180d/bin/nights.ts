/** Runs nights from where the club stands up to `to`, with the real message consumers, and snapshots the checkpoints. */
import { join } from 'node:path';
import { buildCalendar } from '../src/calendar/calendar.ts';
import type { ServiceSet } from '../src/cli/args.ts';
import { say } from '../src/log.ts';
import { checkpointNights } from '../src/night/checkpoints.ts';
import { runNight, type NightDeps } from '../src/night/runner.ts';
import { runDir } from '../src/paths.ts';
import { nightReached, runIdOf } from './club.ts';
import { createMessenger } from './messages.ts';
import { sql, sqlAsync } from './stack/psql.ts';
import { snapshot } from './stack/snapshot.ts';
import { status } from './stack/supabase.ts';

function nightDeps(repoRoot: string): NightDeps {
  const messenger = createMessenger(status(repoRoot));
  return {
    sql,
    async together([first, second]) {
      // Both sessions start before either is awaited.
      const [a, b] = await Promise.all([sqlAsync(first), sqlAsync(second)]);
      return [a, b];
    },
    messages: (at, down) => messenger.run(at, down),
  };
}

function summary(n: number): string {
  return sql(`select format('seated %s, refused %s, checks failing %s',
      (select count(*) from sim.log where day = ${n} and ok and action in ('floor.seat_from_waitlist', 'floor.seat_member')),
      (select count(*) from sim.log where day = ${n} and not ok and not expected_failure),
      (select count(*) from sim.invariant_result where day = ${n} and status <> 'pass'))`).trim();
}

export async function runNights(repoRoot: string, to: number, set: ServiceSet): Promise<void> {
  const deps = nightDeps(repoRoot);
  const calendar = buildCalendar();
  const checkpoints = checkpointNights(calendar);
  const snapshots = join(runDir(runIdOf()), 'snapshots');
  for (const night of calendar.filter((each) => each.n > nightReached() && each.n <= to)) {
    const started = Date.now();
    const result = await runNight(night, deps);
    const seconds = Math.round((Date.now() - started) / 1000);
    say(`night ${String(night.n)} ${night.date}: ${summary(night.n)}; messages ${String(result.delivered)} sent, ${String(result.failed)} failed; ${String(seconds)} s`);
    if (checkpoints.includes(night.n)) snapshot(repoRoot, set, snapshots, `night-${String(night.n)}`);
  }
}
