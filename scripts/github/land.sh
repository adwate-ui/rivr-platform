#!/usr/bin/env bash
# Lands a pull request on main (decision 0243). Run it once the pull request's local verify and reviews passed and
# post-agent-review.sh posted agent-review. It turns on auto-merge (squash) and keeps the branch up to date with main
# until GitHub merges it: each update re-runs CI, and agent-review is posted again on the new head, since an update
# from main leaves the reviewed diff as it was. It stops on a failed required check or a conflict. Once merged it
# prints each CI job's time: a job over 15 minutes is a cause to find before the next pull request.
#   scripts/github/land.sh <pr-number>
set -euo pipefail

pr="${1:?pull request number}"
[[ "$pr" =~ ^[0-9]+$ ]] || { echo "The pull request number must be digits." >&2; exit 1; }
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"

head_sha() { gh pr view "$pr" --json headRefOid --jq .headRefOid; }
failed_checks() { (gh pr checks "$pr" --required 2>/dev/null || true) | awk -F'\t' '$2 == "fail" { print $1 }'; }

reason="$(gh api "repos/$repo/commits/$(head_sha)/statuses" \
  --jq '[.[] | select(.context == "agent-review" and .state == "success")][0].description // empty')"
[ -n "$reason" ] || { echo "No agent-review success on #$pr's head: post it once the reviews pass." >&2; exit 1; }

gh pr merge "$pr" --auto --squash
while :; do
  read -r state merge_state <<<"$(gh pr view "$pr" --json state,mergeStateStatus --jq '"\(.state) \(.mergeStateStatus)"')"
  if [ "$state" = MERGED ]; then break; fi
  if [ "$state" != OPEN ]; then echo "#$pr is $state." >&2; exit 1; fi
  case "$merge_state" in
    DIRTY)
      echo "#$pr conflicts with main: merge main into the branch, re-run verify, push, then run this again." >&2
      exit 1 ;;
    BEHIND)
      old="$(head_sha)"
      gh pr update-branch "$pr" >/dev/null
      while [ "$(head_sha)" = "$old" ]; do sleep 5; done
      "$here/post-agent-review.sh" "$pr" success "$reason" ;;
  esac
  failed="$(failed_checks)"
  if [ -n "$failed" ]; then echo "#$pr: required check failed: $failed" >&2; exit 1; fi
  sleep 30
done

echo "#$pr merged."
gh pr view "$pr" --json statusCheckRollup \
  --jq '.statusCheckRollup[] | select(.startedAt != null and .completedAt != null)
        | "\(.name)\t\((((.completedAt | fromdate) - (.startedAt | fromdate)) / 60) | floor)"' |
  while IFS=$'\t' read -r name minutes; do
    echo "CI $name: $minutes min"
    if [ "$minutes" -gt 15 ]; then echo "  over 15 minutes: find the cause before the next pull request"; fi
  done
