#!/usr/bin/env bash
# Lands a pull request on main (decision 0243). Run it once the pull request's local verify and reviews passed and
# post-agent-review.sh posted agent-review on the reviewed head. It turns on auto-merge (squash) and, whenever main
# moves past the branch, has GitHub merge main into it and posts agent-review again on that merge: an update from main
# leaves the reviewed diff as it was. It stops if the head moves any other way (a push nobody reviewed), on a failed
# or cancelled required check, on a conflict, or after two hours. Once merged it prints each CI job's time: a job over
# 15 minutes is a cause to find before the next pull request.
#   scripts/github/land.sh <pr-number>
set -euo pipefail

pr="${1:?pull request number}"
[[ "$pr" =~ ^[0-9]+$ ]] || { echo "The pull request number must be digits." >&2; exit 1; }
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
deadline=$(($(date +%s) + 2 * 3600))

head_sha() { gh api "repos/$repo/pulls/$pr" --jq .head.sha; }
# The latest agent-review on a commit: its state, a tab, its description.
review_of() { gh api "repos/$repo/commits/$1/status" --jq '.statuses[] | select(.context == "agent-review") | "\(.state)\t\(.description)"'; }
# How many commits main has that the commit lacks.
behind_main() { gh api "repos/$repo/compare/$1...main" --jq .ahead_by; }
failed_checks() { (gh pr checks "$pr" --required 2>/dev/null || true) | awk -F'\t' '$2 == "fail" || $2 == "cancel" { print $1 }'; }
in_time() { [ "$(date +%s)" -lt "$deadline" ] || { echo "#$pr: not merged after two hours; look at its checks." >&2; exit 1; }; }

expected="$(head_sha)"
IFS=$'\t' read -r review reason <<<"$(review_of "$expected")"
[ "${review:-}" = success ] || { echo "agent-review is not success on #$pr's head: post it once the reviews pass." >&2; exit 1; }

gh pr merge "$pr" --auto --squash
while :; do
  in_time
  read -r state merged <<<"$(gh api "repos/$repo/pulls/$pr" --jq '"\(.state) \(.merged)"')"
  if [ "$merged" = true ]; then break; fi
  if [ "$state" != open ]; then echo "#$pr was closed without merging." >&2; exit 1; fi
  head="$(head_sha)"
  if [ "$head" != "$expected" ]; then
    echo "#$pr's head moved to $head, which nobody reviewed: review it, post agent-review, then run this again." >&2
    exit 1
  fi
  if [ "$(behind_main "$head")" -gt 0 ]; then
    if ! gh api --method PUT "repos/$repo/pulls/$pr/update-branch" -f expected_head_sha="$head" >/dev/null; then
      echo "#$pr cannot take main (a conflict?): merge main into the branch, re-run verify, push, review, run this again." >&2
      exit 1
    fi
    while [ "$(head_sha)" = "$head" ]; do in_time; sleep 5; done
    expected="$(head_sha)"
    # GitHub's merge of main into the reviewed head, and nothing else.
    if [ "$(gh api "repos/$repo/commits/$expected" --jq '.parents[0].sha')" != "$head" ]; then
      echo "#$pr: the head after the update, $expected, is not a merge onto the reviewed head." >&2
      exit 1
    fi
    "$here/post-agent-review.sh" "$pr" success "$reason"
  fi
  failed="$(failed_checks)"
  if [ -n "$failed" ]; then echo "#$pr: required check failed or cancelled: $failed" >&2; exit 1; fi
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
