#!/usr/bin/env bash
# Proves the nightly backup against the local stack (#25), so it can't go stale before the nightly job
# has its settings.
#
# It signs the backup in as the read-only role rivr_backup, with a throwaway password, to show a backup
# needs no more. It makes a throwaway key and a backup, then decrypts the archive and checks:
# - the checksum matches;
# - the dump's three files are there, and cron.sql schedules every cron job;
# - the manifest lists every public table with the row count the database has.
# The restore itself is the drill's (#26).
set -euo pipefail

cd "$(git rev-parse --show-toplevel)"
admin_url="$(pnpm -s supabase status -o env | sed -n 's/^DB_URL="\(.*\)"$/\1/p')"
[[ -n "$admin_url" ]] || { echo "The local stack is not running: pnpm db:start"; exit 1; }
work="$(mktemp -d)"
password="$(openssl rand -hex 16)"
trap 'psql "$admin_url" -q -c "alter role rivr_backup with nologin password null" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
psql "$admin_url" -q -v ON_ERROR_STOP=1 -c "alter role rivr_backup with login password '$password'"
backup_url="$(sed -E "s#//[^@]*@#//rivr_backup:${password}@#" <<<"$admin_url")"

age-keygen -o "$work/key.txt" 2>/dev/null
BACKUP_DB_URL="$backup_url" BACKUP_AGE_RECIPIENT="$(age-keygen -y "$work/key.txt")" \
  bash scripts/backup/nightly-backup.sh "$work/out" check

(cd "$work/out" && sha256sum --check --quiet check.tar.gz.age.sha256)
age -d -i "$work/key.txt" "$work/out/check.tar.gz.age" | tar -xz -C "$work"
for file in roles.sql schema.sql data.sql manifest.csv; do
  [[ -s "$work/check/$file" ]] || { echo "The backup has no $file"; exit 1; }
done
jobs="$(psql "$admin_url" -At -c "select count(*) from cron.job")"
[[ "$(grep -c '^select cron.schedule(' "$work/check/cron.sql")" == "$jobs" ]] || { echo "The backup's cron.sql lacks some of the $jobs cron jobs"; exit 1; }

expected="$(psql "$admin_url" -At -v ON_ERROR_STOP=1 -c "
  select string_agg(format('%s,%s', t.tablename,
                           (xpath('/row/n/text()', query_to_xml(format('select count(*) as n from public.%I', t.tablename), false, true, '')))[1]::text),
                    E'\n' order by t.tablename)
  from pg_tables t where t.schemaname = 'public'")"
if [[ "$(tail -n +2 "$work/check/manifest.csv")" != "$expected" ]]; then
  echo "The manifest's tables or row counts differ from the database's"
  diff <(tail -n +2 "$work/check/manifest.csv") <(echo "$expected") || true
  exit 1
fi
echo "Backup checked as rivr_backup: $(tail -n +2 "$work/check/manifest.csv" | wc -l) tables, every row count as the database has it, all $jobs cron jobs."
