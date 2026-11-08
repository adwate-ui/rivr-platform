import { homedir } from 'node:os';
import { join } from 'node:path';

/** Everything a run makes lives here, outside the repository. */
export const SIM_HOME = join(homedir(), '.rivr-sim180');

/** The rewritten copy of supabase/ for one commit. */
export function srcDir(commit: string): string {
  return join(SIM_HOME, 'src', commit);
}

/** One run's snapshots, logs, captures and report. */
export function runDir(runId: string): string {
  return join(SIM_HOME, 'runs', runId);
}
