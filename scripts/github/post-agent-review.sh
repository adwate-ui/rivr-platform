#!/usr/bin/env bash
# Posts the agent-review status on a pull request's head commit: the required check that says the
# reviewer session reviewed it. Only the reviewer session runs this, never a lane (question #176).
# It is the one GitHub write the agent settings allow, so it can post nothing but this status.
#   scripts/github/post-agent-review.sh <pr-number> <success|failure> "<one-line reason>"
set -euo pipefail

pr="${1:?pull request number}"
state="${2:?success or failure}"
reason="${3:?a one-line reason}"
[[ "$pr" =~ ^[0-9]+$ ]] || { echo "The pull request number must be digits." >&2; exit 1; }
[[ "$state" == success || "$state" == failure ]] || { echo "The state must be success or failure." >&2; exit 1; }

repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
sha="$(gh api "repos/$repo/pulls/$pr" --jq .head.sha)"
gh api --method POST "repos/$repo/statuses/$sha" \
  -f state="$state" -f context=agent-review -f description="${reason:0:140}" >/dev/null
echo "agent-review: $state on $sha (pull request #$pr)"
