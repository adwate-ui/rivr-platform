import { execFileSync } from 'node:child_process';
import { parseArgs } from '../src/cli/args.ts';
import { say } from '../src/log.ts';
import { sql } from './stack/psql.ts';
import { prepare } from './stack/prepare.ts';
import { reset, start, stop } from './stack/supabase.ts';

const repoRoot = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
const args = parseArgs(process.argv.slice(2));

if (args.stop) {
  stop(repoRoot);
} else {
  if (args.prepare) await prepare(repoRoot);
  if (args.start !== null) start(repoRoot, args.start);
  if (args.reset) reset(repoRoot);
  say(`clock: ${sql('select sim_clock.now()').trim()}`);
}
