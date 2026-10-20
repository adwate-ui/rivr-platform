#!/usr/bin/env bash
# Restores an unpacked nightly backup into a database (#26). Both the runbook's restore and the drill
# run it. It loads the roles, the schema, and the data with triggers off, in one transaction; then the
# cron jobs, unless --no-cron is given (the drill checks the data first, before any job runs). Two
# kinds of lines in the dump are left out, because a new Supabase project refuses them:
# - grants of server parameters to the platform's own roles, which it has already made itself and only
#   a superuser could make again;
# - loads into empty tables, which restore nothing. Some of the platform's own tables, such as Storage's
#   newer ones, refuse even an empty load.
#
# With --files, and STORAGE_S3_* naming the new project's Storage (its S3 endpoint and an access key), the
# files the backup holds then go back into its buckets with the same paths, so each record still finds its
# file: a KYC selfie stays where its kyc_record points (#386). The buckets themselves come back with the
# data. Files are written only when asked, so a shell that still holds another project's key never
# writes there by accident.
#
# Usage: [STORAGE_S3_ENDPOINT=... STORAGE_S3_ACCESS_KEY_ID=... STORAGE_S3_SECRET_ACCESS_KEY=... STORAGE_S3_REGION=...]
#        scripts/backup/restore.sh [--no-cron] [--files] <unpacked backup folder> <database URL>   (needs psql 17, and the AWS CLI for files)
set -euo pipefail

with_cron=true
with_files=false
while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --no-cron) with_cron=false ;;
    --files) with_files=true ;;
    *) echo "Unknown option $1"; exit 1 ;;
  esac
  shift
done
backup="$1"
url="$2"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

sed -E '/^GRANT [A-Z ,]+ ON PARAMETER .* TO "supabase_/d' "$backup/roles.sql" > "$work/roles.sql"
# Only a COPY header met outside a load starts one, so a data row can never be taken for a header.
awk '
  in_copy { print; if ($0 == "\\.") in_copy = 0; next }
  /^COPY .* FROM stdin;$/ {
    header = $0
    if ((getline line) > 0 && line == "\\.") next
    print header; print line; in_copy = (line != "\\."); next
  }
  { print }
' "$backup/data.sql" > "$work/data.sql"

psql --single-transaction --quiet --variable ON_ERROR_STOP=1 \
  --file "$work/roles.sql" --file "$backup/schema.sql" \
  --command 'SET session_replication_role = replica' --file "$work/data.sql" \
  --dbname "$url" > /dev/null
if ! $with_files; then
  [[ -d "$backup/storage" ]] && echo "The backup's Storage files were left out (no --files). The runbook's restore says how to copy them on their own."
elif [[ -d "$backup/storage" ]]; then
  : "${STORAGE_S3_ENDPOINT:?the new project's Storage S3 endpoint}"
  export AWS_ACCESS_KEY_ID="${STORAGE_S3_ACCESS_KEY_ID:?the S3 access key for Storage}" AWS_SECRET_ACCESS_KEY="${STORAGE_S3_SECRET_ACCESS_KEY:?its secret}"
  export AWS_DEFAULT_REGION="${STORAGE_S3_REGION:-auto}" AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
  for bucket in "$backup"/storage/*/; do
    [[ -d "$bucket" ]] || continue
    # A file over one the restored records already name is written again: S3's put replaces.
    aws s3 cp "$bucket" "s3://$(basename "$bucket")" --recursive --no-progress --only-show-errors --endpoint-url "$STORAGE_S3_ENDPOINT"
  done
fi
if $with_cron; then
  psql --quiet --variable ON_ERROR_STOP=1 --file "$backup/cron.sql" --dbname "$url" > /dev/null
fi
