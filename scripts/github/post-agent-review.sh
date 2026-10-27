#!/usr/bin/env bash
# Posts the agent-review status on a pull request's head commit: the required check that says the
# review subagents passed it (docs/decisions/0024). Run it only after they have, never to skip one.
# It is the one GitHub write the agent settings allow, so it can post nothing but this status.
#   scripts/github/post-agent-review.sh <pr-number> <success|failure> "<one-line reason>" [<commit sha>]
# The commit is the pull request's head unless given: land.sh names the one it checked.
set -euo pipefail

pr="${1:?pull request number}"
state="${2:?success or failure}"
reason="${3:?a one-line reason}"
[[ "$pr" =~ ^[0-9]+$ ]] || { echo "The pull request number must be digits." >&2; exit 1; }
[[ "$state" == success || "$state" == failure ]] || { echo "The state must be success or failure." >&2; exit 1; }

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
sha="${4:-$(gh api "repos/$repo/pulls/$pr" --jq .head.sha)}"
[[ "$sha" =~ ^[0-9a-f]{40}$ ]] || { echo "The commit must be a full sha." >&2; exit 1; }
gh api --method POST "repos/$repo/statuses/$sha" \
  -f state="$state" -f context=agent-review -f description="${reason:0:140}" >/dev/null
echo "agent-review: $state on $sha (pull request #$pr)"
