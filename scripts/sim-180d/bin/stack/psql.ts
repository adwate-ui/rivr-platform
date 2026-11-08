import { execFileSync } from 'node:child_process';
import { DB_CONTAINER } from '../../src/paths.ts';

const PSQL = ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-X', '-q', '-At', '-F', '\t', '-v', 'ON_ERROR_STOP=1'];

/**
 * Runs SQL in the copy's database as postgres and returns psql's unaligned, tab-separated output.
 * The same runner as the 90-day run (run.ts:13-18): psql inside the container, no client library.
 */
export function sql(text: string): string {
  return execFileSync('docker', PSQL, { input: text, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
}
