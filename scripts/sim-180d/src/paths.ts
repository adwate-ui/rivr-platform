import { homedir } from 'node:os';
import { join } from 'node:path';

/** Everything a run makes lives here, outside the repository. */
export const SIM_HOME = join(homedir(), '.rivr-sim180');

/** The Supabase project of the copy: its folder name, and so its project_id and container names. */
export const PROJECT_ID = 'rivr-sim180-db';

/** The copy of supabase/ and packages/ with every time call rewritten. Rebuilt by each prepare. */
export const DB_ROOT = join(SIM_HOME, PROJECT_ID);

/** The copy's Postgres container, for psql, pg_dump and pg_restore. */
export const DB_CONTAINER = `supabase_db_${PROJECT_ID}`;

/** Its own ports: block 557 gives API 55721 and database 55722. Block 556 is the 90-day run's. */
export const PORT_BLOCK = 557;

/** One run's snapshots, logs, captures and report. */
export function runDir(runId: string): string {
  return join(SIM_HOME, 'runs', runId);
}
