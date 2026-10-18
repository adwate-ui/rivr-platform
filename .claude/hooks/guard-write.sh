#!/usr/bin/env bash
# PreToolUse on Edit|Write|MultiEdit. Exit 2 blocks the write and tells Claude why.
set -uo pipefail
input=$(cat)
path=$(jq -r '.tool_input.file_path // empty' <<<"$input")
text=$(jq -r '[.tool_input.content, .tool_input.new_string, (.tool_input.edits // [] | .[].new_string)] | map(select(. != null)) | join("\n")' <<<"$input")
[[ -z "$path" ]] && exit 0
root="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"
rel="${path#"$root"/}"

block() { echo "Blocked by .claude/hooks/guard-write.sh: $1" >&2; exit 2; }

# Applied migrations are immutable.
if [[ "$rel" == supabase/migrations/* ]] && git -C "$root" cat-file -e "origin/main:$rel" 2>/dev/null; then
  block "$rel is already on main. Write a new migration instead (skill: new-migration)."
fi

# Apps never style.
if [[ "$rel" == apps/* ]]; then
  [[ "$rel" =~ \.(css|scss|sass|less)$ ]] && block "apps contain no stylesheets. Put visual work in @rivr/ui."
  if [[ "$rel" =~ \.(tsx|jsx|astro)$ ]]; then
    grep -Eq '\bclassName=|\bstyle=\{' <<<"$text" && block "className and style are not allowed in apps. Use @rivr/ui components and their props."
    grep -Eq '<(div|span|p|a|b|i|strong|em|button|input|select|textarea|img|picture|svg|path|ul|ol|li|dl|table|thead|tbody|tfoot|tr|td|th|form|label|fieldset|section|article|aside|header|footer|main|nav|h[1-6]|dialog|iframe|video|audio|canvas|hr|br)[[:space:]/>]' <<<"$text" \
      && block "raw HTML elements are not allowed in apps. Compose @rivr/ui (Box, Stack, Text, Button...). If something is missing, use the new-ui-component skill."
  fi
  grep -Eq "from ['\"](@radix-ui|tailwind|lucide|react-icons|@heroicons|styled-components|@emotion|clsx|class-variance-authority)" <<<"$text" \
    && block "styling and icon libraries are imported only inside @rivr/ui."
fi

# Raw design values live only in @rivr/tokens.
if [[ "$rel" =~ ^(apps|packages)/ && "$rel" != packages/tokens/* && "$rel" =~ \.(ts|tsx|css|astro)$ ]]; then
  grep -Eq "['\"\`]#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?([0-9a-fA-F]{2})?['\"\`]" <<<"$text" && block "hex colour outside @rivr/tokens. Use a token."
  grep -Eq '\[[0-9.]+(px|rem)\]' <<<"$text" && block "arbitrary size outside the token scale. Use a token."
fi
exit 0
