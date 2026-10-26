/**
 * Every migration in supabase/migrations needs a version of its own: the 14-digit timestamp before its
 * name. Two with one version pass every local and CI run (each applies in a fresh database), then the
 * staging deploy refuses the second (`schema_migrations_pkey`), as it did when #454 and #458 both used
 * 20261026150000 (#459). Lists any version two files share, and fails.
 */
import { readdirSync } from 'node:fs';

const files = readdirSync('supabase/migrations').filter((file) => file.endsWith('.sql'));
const byVersion = new Map();
for (const file of files) {
  const version = file.slice(0, 14);
  byVersion.set(version, [...(byVersion.get(version) ?? []), file]);
}
const shared = [...byVersion].filter(([, named]) => named.length > 1);
for (const [version, named] of shared) process.stderr.write(`Migration version ${version} is used by ${named.join(' and ')}\n`);
if (shared.length > 0) {
  process.stderr.write('Give each migration a version after the newest on main.\n');
  process.exit(1);
}
process.stdout.write(`${files.length} migrations, each with a version of its own.\n`);
