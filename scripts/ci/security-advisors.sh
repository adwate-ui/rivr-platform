#!/usr/bin/env bash
# Runs Supabase's database advisors (splinter) against the local database and fails on any
# security finding at WARN or ERROR level: RLS disabled, policies that leak, exposed auth
# data, functions with a mutable search_path, and the rest of the security lints.
# docs/engineering/stack.md, "Security checks in CI".
set -euo pipefail

SPLINTER_VERSION=2026.09.1
root="$(git rev-parse --show-toplevel)"
container="supabase_db_$(basename "$root" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')"
splinter="$(mktemp)"
curl -fsSL "https://raw.githubusercontent.com/supabase/splinter/${SPLINTER_VERSION}/splinter.sql" -o "$splinter"

# splinter.sql is a setup block (`set local` and a `do $$ ... end $$;`) followed by one query.
# Run the setup, store the query's rows in a temp table, and keep only security findings.
setup_end="$(grep -n 'end \$\$;' "$splinter" | head -1 | cut -d: -f1)"
{
  echo 'begin;'
  head -n "$setup_end" "$splinter"
  echo 'create temp table lint as'
  tail -n "+$((setup_end + 1))" "$splinter"
  echo ';'
  echo "select level || ' ' || name || ': ' || detail from pg_temp.lint"
  echo "where 'SECURITY' = any(categories) and level in ('ERROR', 'WARN') order by level, name;"
  echo 'rollback;'
} > "$splinter.run"

# A psql failure must stop the script, not read as "no findings", so capture first, then filter.
output="$(docker exec -i "$container" psql -U postgres -d postgres -At -v ON_ERROR_STOP=1 < "$splinter.run")"
rm -f "$splinter" "$splinter.run"
findings="$(grep -vE '^(BEGIN|ROLLBACK|SET|DO|SELECT [0-9]+)$' <<<"$output" || true)"
if [[ -n "$findings" ]]; then
  echo "Security advisors found problems:"
  echo "$findings"
  exit 1
fi
echo "Security advisors: no findings."
