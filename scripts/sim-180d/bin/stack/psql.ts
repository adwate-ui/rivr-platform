import { execFileSync, spawn } from 'node:child_process';
import { DB_CONTAINER } from '../../src/paths.ts';

const PSQL = ['exec', '-i', DB_CONTAINER, 'psql', '-U', 'postgres', '-X', '-q', '-At', '-F', '\t', '-v', 'ON_ERROR_STOP=1'];

/**
 * Runs SQL in the copy's database as postgres and returns psql's unaligned, tab-separated output.
 * The same runner as the 90-day run (run.ts:13-18): psql inside the container, no client library.
 */
export function sql(text: string): string {
  return execFileSync('docker', PSQL, { input: text, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024 });
}

/** The same in its own psql session, without waiting: two of these at once are two people acting at once. */
export function sqlAsync(text: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn('docker', PSQL, { stdio: ['pipe', 'pipe', 'pipe'] });
    let out = '';
    let errors = '';
    child.stdout.on('data', (chunk: Buffer) => {
      out += chunk.toString('utf8');
    });
    child.stderr.on('data', (chunk: Buffer) => {
      errors += chunk.toString('utf8');
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve(out);
      else reject(new Error(`psql exited ${String(code)}: ${errors.trim()}`));
    });
    child.stdin.end(text);
  });
}
