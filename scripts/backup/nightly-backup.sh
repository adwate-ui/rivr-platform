#!/usr/bin/env bash
# The nightly backup (#25; tech plan item 27; features "Backups and exports"; decision 0072).
#
# It writes:
# - a logical dump of the whole database, made the way Supabase's backup guide makes it (roles, schema,
#   then data as COPY), plus the cron jobs as the calls that schedule them again (cron.sql). The Vault is
#   not in it;
# - every table in public as CSV, with a manifest of row counts, all from one snapshot of their own.
# Everything goes into one archive, encrypted to the backup key with age. Without the private key, which
# is never in CI, the file is unreadable.
#
# It runs as the read-only role rivr_backup. The Supabase CLI's dump script (printed by --dry-run) is run
# without the one line that would switch to postgres, which a read-only role can't do. It needs
# pg_dump, pg_dumpall and psql for the server's Postgres version.
#
# Usage: BACKUP_DB_URL=postgresql://rivr_backup... BACKUP_AGE_RECIPIENT=age1... scripts/backup/nightly-backup.sh <out-dir> <name>
# Writes <out-dir>/<name>.tar.gz.age and <out-dir>/<name>.tar.gz.age.sha256. Nothing unencrypted is left behind.
set -euo pipefail

out="$(realpath -m "$1")"
name="$2"
: "${BACKUP_DB_URL:?the database to back up}" "${BACKUP_AGE_RECIPIENT:?the age public key to encrypt to}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT
mkdir -p "$work/$name/csv" "$out"
cd "$(git rev-parse --show-toplevel)"

# One of the CLI's dump scripts, without --role "postgres", run here: dump <file> [supabase db dump flags]
dump() {
  local file="$1"
  shift
  pnpm -s supabase db dump --db-url "$BACKUP_DB_URL" "$@" --dry-run 2>/dev/null \
    | sed -n '/^#!\/usr\/bin\/env bash/,$p' | sed -E '/^\s*--role "postgres" \\$/d' > "$work/dump.sh"
  grep -q '^pg_dump' "$work/dump.sh" || { echo "The Supabase CLI printed no dump script"; exit 1; }
  bash "$work/dump.sh" > "$file"
}
dump "$work/$name/roles.sql" --role-only
dump "$work/$name/schema.sql"
dump "$work/$name/data.sql" --use-copy --data-only
# pg_cron's jobs belong to the extension, so no dump has them.
psql "$BACKUP_DB_URL" -At -v ON_ERROR_STOP=1 \
  -c "select format('select cron.schedule(%L, %L, %L);', jobname, schedule, command) from cron.job order by jobname" \
  > "$work/$name/cron.sql"

# Every table in public, each to its own CSV, and the manifest counted in the same transaction.
tables="$(psql "$BACKUP_DB_URL" -At -v ON_ERROR_STOP=1 -c "select tablename from pg_tables where schemaname = 'public' order by 1")"
counts=""
{
  echo 'begin transaction isolation level repeatable read read only;'
  for table in $tables; do
    echo "\\copy (select * from public.\"$table\") to 'csv/$table.csv' with (format csv, header)"
    counts="${counts:+$counts union all }select '$table' as table_name, count(*) as row_count from public.\"$table\""
  done
  echo "\\copy ($counts order by 1) to 'manifest.csv' with (format csv, header)"
  echo 'commit;'
} > "$work/export.sql"
(cd "$work/$name" && psql "$BACKUP_DB_URL" -q -v ON_ERROR_STOP=1 -f "$work/export.sql")

tar -C "$work" -czf "$work/$name.tar.gz" "$name"
age -r "$BACKUP_AGE_RECIPIENT" -o "$out/$name.tar.gz.age" "$work/$name.tar.gz"
(cd "$out" && sha256sum "$name.tar.gz.age" > "$name.tar.gz.age.sha256")
echo "Backup written: $out/$name.tar.gz.age ($(wc -w <<<"$tables") tables)"
