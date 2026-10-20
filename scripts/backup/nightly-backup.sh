#!/usr/bin/env bash
# The nightly backup (#25; tech plan item 27; features "Backups and exports"; decision 0072).
#
# It writes:
# - a logical dump of the whole database, made the way Supabase's backup guide makes it (roles, schema,
#   then data as COPY), plus the cron jobs as the calls that schedule them again (cron.sql). The Vault is
#   not in it;
# - every table in public as CSV, with a manifest of row counts, all from one snapshot of their own;
# - every file in Supabase Storage, KYC photos and media alike, under storage/<bucket>/ with the paths it
#   has there, and storage.csv listing each with its size (#386, decision 0108). It reads Storage through
#   its S3 endpoint with the backup's own access key, given as STORAGE_S3_*; the nightly job always gives
#   it. Without them (the restore drill, which tests the database) the archive has no files.
# Everything goes into one archive, encrypted to the backup key with age. Without the private key, which
# is never in CI, the file is unreadable.
#
# It runs as the read-only role rivr_backup. The Supabase CLI's dump script (printed by --dry-run) is run
# without the one line that would switch to postgres, which a read-only role can't do. It needs
# pg_dump, pg_dumpall and psql for the server's Postgres version.
#
# Usage: BACKUP_DB_URL=postgresql://rivr_backup... BACKUP_AGE_RECIPIENT=age1... [STORAGE_S3_ENDPOINT=https://... STORAGE_S3_ACCESS_KEY_ID=...
#        STORAGE_S3_SECRET_ACCESS_KEY=... STORAGE_S3_REGION=...] scripts/backup/nightly-backup.sh <out-dir> <name>
# Writes <out-dir>/<name>.tar.gz.age and <out-dir>/<name>.tar.gz.age.sha256. Nothing unencrypted is left behind:
# the files are copied into the temporary folder that is encrypted and then removed.
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

# Every bucket's files, with their paths, so a restore puts each back where its record points.
files=0
if [[ -n "${STORAGE_S3_ENDPOINT:-}" ]]; then
  : "${STORAGE_S3_ACCESS_KEY_ID:?the S3 access key for Storage}" "${STORAGE_S3_SECRET_ACCESS_KEY:?its secret}"
  export AWS_ACCESS_KEY_ID="$STORAGE_S3_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$STORAGE_S3_SECRET_ACCESS_KEY"
  export AWS_DEFAULT_REGION="${STORAGE_S3_REGION:-auto}" AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
  mkdir -p "$work/$name/storage"
  # The files Storage's records name, counted first: the copy must find at least as many. A key revoked
  # or a wrong region fails the listing below, and set -e stops the night, so it never passes empty.
  expected="$(psql "$BACKUP_DB_URL" -At -v ON_ERROR_STOP=1 -c "select count(*) from storage.objects")"
  buckets="$(aws s3api list-buckets --endpoint-url "$STORAGE_S3_ENDPOINT" --query 'Buckets[].Name' --output text)"
  for bucket in $buckets; do
    aws s3 cp "s3://$bucket" "$work/$name/storage/$bucket" --recursive --no-progress --only-show-errors --endpoint-url "$STORAGE_S3_ENDPOINT"
  done
  (cd "$work/$name/storage" && find . -type f -printf '%P,%s\n' | sort) > "$work/$name/storage.csv"
  files="$(wc -l < "$work/$name/storage.csv")"
  if (( files < expected )); then
    echo "Storage's records name $expected files, but only $files were copied"
    exit 1
  fi
fi

tar -C "$work" -czf "$work/$name.tar.gz" "$name"
age -r "$BACKUP_AGE_RECIPIENT" -o "$out/$name.tar.gz.age" "$work/$name.tar.gz"
(cd "$out" && sha256sum "$name.tar.gz.age" > "$name.tar.gz.age.sha256")
echo "Backup written: $out/$name.tar.gz.age ($(wc -w <<<"$tables") tables, $files Storage files)"
