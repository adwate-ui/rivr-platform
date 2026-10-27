#!/usr/bin/env bash
# The restore drill (#26; tech plan item 27 and hardening week; docs/runbooks/backups-and-restore.md).
#
# It restores a nightly backup into a scratch database: a throwaway local Supabase stack with nothing in
# it, as a new project would be, on the unassigned port block 550 (the worktrees use 543 to 549). It
# restores with the runbook's own script (scripts/backup/restore.sh), checks the result, prints PASS or
# FAIL, and removes the scratch stack. It never touches staging or production. The checks, made before
# any restored cron job could write:
# - every ledger transaction sums to zero;
# - each ledger account's total equals the total from the backup's own CSV of ledger_entry, a second
#   copy taken apart from the dump;
# - every public table has the row count manifest.csv has. A ledger table must match exactly. Another
#   table may differ by a few rows, those written in the seconds between the dump and the export, but
#   one that comes back empty, or more than 5 rows or 1% out, fails;
# - then the cron jobs are restored, and all of them are back.
#
# Usage:
#   scripts/backup/restore-drill.sh --archive <file.tar.gz.age> --key <age key file>
#   scripts/backup/restore-drill.sh --latest <staging|production> --key <age key file>
#       needs AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_DEFAULT_REGION=auto, BACKUP_S3_ENDPOINT and
#       BACKUP_BUCKET for that target
#   scripts/backup/restore-drill.sh --local
#       backs up the local stack first (pnpm db:start), with a throwaway key: the drill on one computer
# Add --dry-run to print the steps without running anything. Needs Docker, age, psql 17, the aws CLI
# for --latest, and the repository's packages (pnpm i).
set -euo pipefail

archive="" key="" latest="" local_backup=false dry_run=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --archive) archive="$2"; shift 2 ;;
    --key) key="$2"; shift 2 ;;
    --latest) latest="$2"; shift 2 ;;
    --local) local_backup=true; shift ;;
    --dry-run) dry_run=true; shift ;;
    *) echo "Unknown option $1. See the usage at the top of $0."; exit 2 ;;
  esac
done

root="$(git rev-parse --show-toplevel)"
work="$(mktemp -d)"
scratch="$work/scratch"
scratch_url="postgresql://postgres:postgres@127.0.0.1:55022/postgres"
step() { echo "==> $*"; }
run() { if $dry_run; then echo "    (dry run) $*"; else "$@"; fi; }
cleanup() {
  if [[ -d "$scratch/supabase" ]] && ! $dry_run; then
    # A stack left running would keep a restored copy of members' data in a Docker volume: say so loudly.
    (cd "$root" && pnpm -s exec supabase stop --no-backup --workdir "$scratch" >/dev/null 2>&1) \
      || echo "WARNING: the scratch stack rivr-restore-drill did not stop. Remove it: docker ps | grep restore-drill"
  fi
  rm -rf "$work"
}
trap cleanup EXIT

if $local_backup; then
  step "Back up the local stack with a throwaway key"
  key="$work/key.txt"
  archive="$work/in/drill.tar.gz.age"
  if ! $dry_run; then
    admin_url="$(cd "$root" && pnpm -s supabase status -o env | sed -n 's/^DB_URL="\(.*\)"$/\1/p')"
    [[ -n "$admin_url" ]] || { echo "The local stack is not running: pnpm db:start"; exit 1; }
    age-keygen -o "$key" 2>/dev/null
    # The database alone: a Storage key left in this shell (from a restore) is never read here (#386).
    env -u STORAGE_S3_ENDPOINT -u STORAGE_S3_ACCESS_KEY_ID -u STORAGE_S3_SECRET_ACCESS_KEY \
      BACKUP_DB_URL="$admin_url" BACKUP_AGE_RECIPIENT="$(age-keygen -y "$key")" bash "$root/scripts/backup/nightly-backup.sh" "$work/in" drill >/dev/null
  fi
elif [[ -n "$latest" ]]; then
  step "Download the latest nightly backup of $latest"
  if ! $dry_run; then
    # No apostrophe in these messages: bash takes one inside "${...:?...}" as a quote (restore.sh says more).
    : "${BACKUP_S3_ENDPOINT:?the endpoint of the bucket}" "${BACKUP_BUCKET:?the bucket of the target}"
    night="$(aws s3 ls "s3://$BACKUP_BUCKET/$latest/nightly/" --endpoint-url "$BACKUP_S3_ENDPOINT" | awk '{print $2}' | sort | tail -1)"
    [[ -n "$night" ]] || { echo "No nightly backup of $latest yet"; exit 1; }
    aws s3 cp "s3://$BACKUP_BUCKET/$latest/nightly/$night" "$work/in/" --recursive --no-progress --endpoint-url "$BACKUP_S3_ENDPOINT" >/dev/null
    archive="$(ls "$work"/in/*.tar.gz.age)"
  fi
fi
[[ -n "$archive" && -n "$key" ]] || $dry_run || { echo "Give --archive and --key, --latest and --key, or --local"; exit 2; }

step "Check and decrypt the archive"
if ! $dry_run; then
  if [[ -f "$archive.sha256" ]]; then (cd "$(dirname "$archive")" && sha256sum --check --quiet "$(basename "$archive").sha256"); fi
  mkdir -p "$work/out" && age -d -i "$key" "$archive" | tar -xz -C "$work/out"
fi
backup="$(ls -d "$work"/out/*/ 2>/dev/null | head -1 || true)"

step "Start a scratch Supabase stack on ports 550xx, empty as a new project, with Realtime, whose roles the dump grants to"
mkdir -p "$scratch/supabase"
cat > "$scratch/supabase/config.toml" <<'TOML'
project_id = "rivr-restore-drill"
[api]
port = 55021
[db]
port = 55022
shadow_port = 55020
major_version = 17
[db.pooler]
enabled = false
[studio]
enabled = false
[inbucket]
enabled = false
[analytics]
enabled = false
[edge_runtime]
enabled = false
TOML
run bash -c "cd '$root' && pnpm -s exec supabase start --workdir '$scratch' >/dev/null"

step "Restore as the runbook does (scripts/backup/restore.sh): roles, schema, data with triggers off; the cron jobs after the checks"
run bash "$root/scripts/backup/restore.sh" --no-cron "$backup" "$scratch_url"

step "Check the ledger and the row counts"
$dry_run && { echo "Dry run: nothing restored."; exit 0; }
failed=0
q() { psql "$scratch_url" -At -v ON_ERROR_STOP=1 -c "$1"; }

unbalanced="$(q "select count(*) from (select transaction_id from public.ledger_entry group by transaction_id having sum(amount) <> 0) t")"
[[ "$unbalanced" == 0 ]] && echo "PASS every ledger transaction sums to zero" || { echo "FAIL $unbalanced ledger transactions do not sum to zero"; failed=1; }

restored="$(q "select account_id || ',' || sum(amount) from public.ledger_entry group by account_id order by account_id")"
# ledger_entry.csv: id, venue_id, transaction_id, account_id, amount, ... (no quoted fields; uuids sort the same everywhere).
exported="$(tail -n +2 "$backup/csv/ledger_entry.csv" | awk -F, '{ total[$4] += $5 } END { for (a in total) print a "," total[a] }' | sort)"
[[ "$restored" == "$exported" ]] && echo "PASS each ledger account's total matches the backup's CSV ($(wc -l <<<"$restored") accounts)" \
  || { echo "FAIL ledger account totals differ from the backup's CSV"; failed=1; }

counts_failed=0
while IFS=, read -r table rows; do
  now="$(q "select count(*) from public.\"$table\"")"
  [[ "$now" == "$rows" ]] && continue
  gap=$(( now > rows ? now - rows : rows - now ))
  bound=$(( rows / 100 > 5 ? rows / 100 : 5 ))
  if [[ "$table" == ledger_* ]] || (( now == 0 || gap > bound )); then
    echo "FAIL $table has $now rows, the manifest $rows"; counts_failed=1
  else
    echo "NOTE $table has $now rows, the manifest $rows (written between the dump and the export)"
  fi
done < <(tail -n +2 "$backup/manifest.csv")
if [[ "$counts_failed" == 0 ]]; then echo "PASS row counts for $(($(wc -l < "$backup/manifest.csv") - 1)) tables"; else failed=1; fi

step "Restore the cron jobs, then check them"
psql --quiet --variable ON_ERROR_STOP=1 --file "$backup/cron.sql" --dbname "$scratch_url" > /dev/null
jobs="$(q "select count(*) from cron.job")"
expected="$(grep -c '^select cron.schedule(' "$backup/cron.sql")"
[[ "$jobs" == "$expected" ]] && echo "PASS all $jobs cron jobs are back" || { echo "FAIL $jobs cron jobs, the backup has $expected"; failed=1; }

[[ "$failed" == 0 ]] && echo "RESULT PASS: the backup restores, and its ledger and rows are whole." || echo "RESULT FAIL"
exit "$failed"
