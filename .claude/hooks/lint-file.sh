#!/usr/bin/env bash
# PostToolUse on Edit|Write|MultiEdit. Lints the file just written; exit 2 feeds errors back to Claude.
set -uo pipefail
path=$(jq -r '.tool_input.file_path // empty')
[[ "$path" =~ \.(ts|tsx|astro)$ ]] || exit 0
[[ -f "$path" ]] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
out=$(timeout 60 pnpm -s exec eslint --max-warnings=0 "$path" 2>&1) || { echo "$out" | tail -40 >&2; exit 2; }
exit 0
