#!/usr/bin/env bash
# Stop hook. If code changed, typecheck, lint and unit-test the affected packages before Claude may stop.
set -uo pipefail
input=$(cat)
[[ "$(jq -r '.stop_hook_active // false' <<<"$input")" == "true" ]] && exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

jq -e '.scripts["verify:quick"]' package.json >/dev/null 2>&1 || exit 0
counter="$(git rev-parse --git-dir)/claude-stop-blocks"
git status --porcelain -- apps packages supabase | grep -q . || { rm -f "$counter"; exit 0; }

n=$(cat "$counter" 2>/dev/null || echo 0)
if (( n >= 3 )); then rm -f "$counter"; echo "verify still failing after 3 attempts; stop and report the failure" >&2; exit 0; fi

if out=$(timeout 600 pnpm -s verify:quick 2>&1); then
  rm -f "$counter"; exit 0
fi
echo $((n + 1)) > "$counter"
echo "pnpm verify:quick failed. Fix the root cause before stopping:" >&2
echo "$out" | tail -60 >&2
exit 2
