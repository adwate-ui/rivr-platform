/** The flags of `pnpm --filter @rivr/sim-180d sim -- …`. */
export type ServiceSet = 'sim' | 'ui';

export interface RunArgs {
  /** Rebuild the rewritten copy of supabase/ and packages/ from HEAD. */
  prepare: boolean;
  /** Start the copy's stack with this set of services. */
  start: ServiceSet | null;
  /** Reapply every migration and the seed, which also rewinds the virtual clock. */
  reset: boolean;
  /** Stop the copy's stack and do nothing else. */
  stop: boolean;
  /** Run nights 1 to this one. */
  to: number | null;
  /** Restore this night's checkpoint snapshot first, and carry on from it. */
  from: number | null;
}

const NIGHTS = 180;

function setFlag(args: RunArgs, flag: string): void {
  if (flag === '--prepare') args.prepare = true;
  else if (flag === '--reset') args.reset = true;
  else if (flag === '--stop') args.stop = true;
  else if (flag === '--dry') args.to = 7;
  else if (flag === '--start=sim' || flag === '--start=ui') args.start = flag === '--start=sim' ? 'sim' : 'ui';
  else if (flag.startsWith('--to=')) args.to = nightsOf(flag.slice('--to='.length));
  else if (flag.startsWith('--from=')) args.from = nightsOf(flag.slice('--from='.length));
  else throw new Error(`unknown flag ${flag}`);
}

function nightsOf(value: string): number {
  const nights = Number(value);
  if (!Number.isInteger(nights) || nights < 0 || nights > NIGHTS) throw new Error(`--to must be 0 to ${NIGHTS}`);
  return nights;
}

export function parseArgs(argv: readonly string[]): RunArgs {
  const args: RunArgs = { prepare: false, start: null, reset: false, stop: false, to: null, from: null };
  // pnpm passes the `--` that separates its own flags from the script's.
  for (const flag of argv) if (flag !== '--') setFlag(args, flag);
  if (args.stop && (args.prepare || args.start !== null || args.reset || args.to !== null || args.from !== null)) {
    throw new Error('--stop takes no other flag');
  }
  return args;
}
