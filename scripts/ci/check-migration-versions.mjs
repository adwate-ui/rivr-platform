/**
 * Every migration in supabase/migrations needs a version of its own: the 14-digit timestamp before its
 * name. Two with one version pass every local and CI run (each applies in a fresh database), then the
 * staging deploy refuses the second (`schema_migrations_pkey`), as it did when #454 and #458 both used
 * 20261026150000 (#459). Lists any version two files share, and fails.
 *
 * A migration main does not have yet must also sort after every one main has. A release pushes to production
 * without --include-all, so one older than production's newest is refused; on 27 Oct #541 and #547 were each
 * renumbered by hand after main moved past them. Main is PR_BASE in CI on a pull request, else origin/main;
 * where neither is fetched there is nothing to compare with. Fails naming the version to move past.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';

const version = (file) => file.slice(0, 14);
const files = readdirSync('supabase/migrations').filter((file) => file.endsWith('.sql'));
const byVersion = new Map();
for (const file of files) {
  byVersion.set(version(file), [...(byVersion.get(version(file)) ?? []), file]);
}
const shared = [...byVersion].filter(([, named]) => named.length > 1);
for (const [sharedVersion, named] of shared) process.stderr.write(`Migration version ${sharedVersion} is used by ${named.join(' and ')}\n`);

/** The migrations on main, or null where main is not fetched here. */
function migrationsOnMain() {
  try {
    const listed = execFileSync('git', ['ls-tree', '--name-only', process.env.PR_BASE || 'origin/main', 'supabase/migrations/'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'],
    });
    return listed.split('\n').filter((path) => path.endsWith('.sql')).map((path) => path.split('/').pop());
  } catch {
    return null;
  }
}

const onMain = migrationsOnMain();
const newestOnMain = onMain === null ? null : onMain.map(version).sort().at(-1);
const behind = onMain === null || newestOnMain === undefined ? [] : files.filter((file) => !onMain.includes(file) && version(file) <= newestOnMain);
for (const file of behind) process.stderr.write(`Migration ${file} sorts before main's newest, ${newestOnMain}: give it a later version\n`);

if (shared.length > 0 || behind.length > 0) {
  process.stderr.write('Give each migration a version after the newest on main.\n');
  process.exit(1);
}
process.stdout.write(`${files.length} migrations, each with a version of its own${onMain === null ? '' : ', the new ones after main\'s'}.\n`);
