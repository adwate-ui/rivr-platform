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
# Usage: scripts/backup/restore.sh [--no-cron] <unpacked backup folder> <database URL>   (needs psql 17)
set -euo pipefail

with_cron=true
if [[ "${1:-}" == "--no-cron" ]]; then
  with_cron=false
  shift
fi
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
if $with_cron; then
  psql --quiet --variable ON_ERROR_STOP=1 --file "$backup/cron.sql" --dbname "$url" > /dev/null
fi
