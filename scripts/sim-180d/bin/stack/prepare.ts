import { execFileSync } from 'node:child_process';
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { say } from '../../src/log.ts';
import { DB_ROOT, PORT_BLOCK } from '../../src/paths.ts';
import { rewriteFiles, type FileText } from '../../src/rewrite.ts';

const HERE = new URL('.', import.meta.url).pathname;
const CLOCK = join(HERE, '..', '..', 'sql', '00_clock.sql');

function readSql(dir: string, keep: (name: string) => boolean): FileText[] {
  return readdirSync(dir)
    .filter((name) => name.endsWith('.sql') && keep(name))
    .map((name) => ({ name: join(dir, name), text: readFileSync(join(dir, name), 'utf8') }));
}

/** Copies supabase/ and packages/ at HEAD (Edge Functions import packages/ by relative path). */
function copyHead(repoRoot: string): string {
  rmSync(DB_ROOT, { recursive: true, force: true });
  mkdirSync(DB_ROOT, { recursive: true });
  // Piped, not buffered: the archive is far larger than execFileSync's output buffer. Paths go in as arguments.
  execFileSync('sh', ['-c', 'git -C "$1" archive HEAD supabase packages | tar -x -C "$2"', 'sh', repoRoot, DB_ROOT]);
  const commit = execFileSync('git', ['-C', repoRoot, 'rev-parse', '--short=8', 'HEAD'], { encoding: 'utf8' }).trim();
  writeFileSync(join(DB_ROOT, 'COMMIT'), `${commit}\n`);
  writeFileSync(join(DB_ROOT, '.rivr-port-block'), `${PORT_BLOCK}\n`);
  return commit;
}

/** Rewrites every time call in the copy's migrations and seed, and refuses a copy still reading real time. */
function rewriteCopy(): void {
  const migrations = join(DB_ROOT, 'supabase', 'migrations');
  const seed = join(DB_ROOT, 'supabase', 'seed');
  const result = rewriteFiles([...readSql(migrations, (name) => name.startsWith('2026')), ...readSql(seed, () => true)]);
  if (result.unhandled.length > 0) throw new Error(`time readings left on the real clock:\n${result.unhandled.join('\n')}`);
  for (const file of result.files) writeFileSync(file.name, file.text);
  copyFileSync(CLOCK, join(migrations, '20000101000000_sim_clock.sql'));
  const { now, clock, timestamp, date } = result.counts;
  say(`rewrote ${now} now(), ${clock} clock_timestamp(), ${timestamp} current_timestamp, ${date} current_date`);
}

/** Writes the copy's config.toml through the repository's own writer, so ports and settings follow the template. */
async function writeConfig(repoRoot: string): Promise<void> {
  const writer: unknown = await import(join(repoRoot, 'scripts', 'lib', 'supabase-config.mjs'));
  const write: unknown = typeof writer === 'object' && writer !== null ? Reflect.get(writer, 'writeSupabaseConfig') : null;
  if (typeof write !== 'function') throw new Error('scripts/lib/supabase-config.mjs has no writeSupabaseConfig');
  const block: unknown = write(DB_ROOT);
  if (block !== PORT_BLOCK) throw new Error(`the copy got port block ${String(block)}, not ${PORT_BLOCK}`);
}

export async function prepare(repoRoot: string): Promise<string> {
  const commit = copyHead(repoRoot);
  rewriteCopy();
  await writeConfig(repoRoot);
  say(`prepared ${DB_ROOT} from ${commit}`);
  return commit;
}
