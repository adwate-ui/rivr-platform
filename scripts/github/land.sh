#!/usr/bin/env bash
# Lands a pull request on main (decision 0243). Run it once the pull request's local verify and reviews passed and
# post-agent-review.sh posted agent-review on the reviewed head. It turns on auto-merge (squash) and, whenever main
# moves past the branch, has GitHub merge main into it and posts agent-review again on that merge: an update from main
# leaves the reviewed diff as it was. It stops if the head moves any other way (a push nobody reviewed), on a failed
# or cancelled required check, on a conflict, or after two hours. Once merged it prints each CI job's time (a job over
# 15 minutes is a cause to find before the next pull request), then waits for CI on main at the merge and fails if it
# is not green: that run mutates every money module.
#   scripts/github/land.sh <pr-number>
set -euo pipefail

pr="${1:?pull request number}"
[[ "$pr" =~ ^[0-9]+$ ]] || { echo "The pull request number must be digits." >&2; exit 1; }
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(gh repo view --json nameWithOwner --jq .nameWithOwner)"
deadline=$(($(date +%s) + 2 * 3600))

# A read from GitHub; empty when the call fails, so one failed call is tried again on the next round.
read_api() { gh api "$@" 2>/dev/null || true; }
head_sha() { read_api "repos/$repo/pulls/$pr" --jq .head.sha; }
is_merged() { [ "$(read_api "repos/$repo/pulls/$pr" --jq .merged)" = true ]; }
# The latest agent-review on a commit: its state, a tab, its description.
review_of() { read_api "repos/$repo/commits/$1/status" --jq '.statuses[] | select(.context == "agent-review") | "\(.state)\t\(.description)"'; }
# How many commits main has that the commit lacks.
behind_main() { read_api "repos/$repo/compare/$1...main" --jq .ahead_by; }
# GitHub's own merge of main into the reviewed head: two parents, the first the reviewed head, made and signed by GitHub.
is_update_of() {
  [ "$(read_api "repos/$repo/commits/$1" --jq '[(.parents | length), .parents[0].sha, .commit.committer.email, .commit.verification.verified] | @tsv')" \
    = "$(printf '2\t%s\tnoreply@github.com\ttrue' "$2")" ]
}
failed_checks() { (gh pr checks "$pr" --required 2>/dev/null || true) | awk -F'\t' '$2 == "fail" || $2 == "cancel" { print $1 }'; }
in_time() { [ "$(date +%s)" -lt "$deadline" ] || { echo "#$pr: not merged after two hours; look at its checks." >&2; exit 1; }; }

expected="$(head_sha)"
IFS=$'\t' read -r review reason <<<"$(review_of "$expected")"
[ "${review:-}" = success ] || { echo "agent-review is not success on #$pr's head: post it once the reviews pass." >&2; exit 1; }

gh pr merge "$pr" --auto --squash
while :; do
  in_time
  read -r state merged <<<"$(read_api "repos/$repo/pulls/$pr" --jq '"\(.state) \(.merged)"')"
  if [ -z "${state:-}" ]; then sleep 30; continue; fi
  if [ "$merged" = true ]; then break; fi
  if [ "$state" != open ]; then echo "#$pr was closed without merging." >&2; exit 1; fi
  head="$(head_sha)"
  if [ -z "$head" ]; then sleep 30; continue; fi
  if [ "$head" != "$expected" ]; then
    echo "#$pr's head moved to $head, which nobody reviewed: review it, post agent-review, then run this again." >&2
    exit 1
  fi
  behind="$(behind_main "$head")"
  if [ "${behind:-0}" -gt 0 ]; then
    if ! gh api --method PUT "repos/$repo/pulls/$pr/update-branch" -f expected_head_sha="$head" >/dev/null 2>&1; then
      if is_merged; then break; fi
      echo "#$pr cannot take main (a conflict?): merge main into the branch, re-run verify, push, review, run this again." >&2
      exit 1
    fi
    while next="$(head_sha)"; [ -z "$next" ] || [ "$next" = "$head" ]; do in_time; sleep 5; done
    expected="$next"
    if ! is_update_of "$expected" "$head"; then
      echo "#$pr: the head after the update, $expected, is not GitHub's merge of main onto the reviewed head." >&2
      exit 1
    fi
    "$here/post-agent-review.sh" "$pr" success "$reason" "$expected"
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

# Main's own run after the merge mutates every money module, which catches what a pull request's run cannot: a change
# to one module's tests that moves another's score. A red main is fixed before anything else lands.
main_deadline=$(($(date +%s) + 3600))
until merge_sha="$(read_api "repos/$repo/pulls/$pr" --jq '.merge_commit_sha // empty')"; [ -n "$merge_sha" ]; do
  if [ "$(date +%s)" -ge "$main_deadline" ]; then echo "#$pr merged, but its merge commit could not be read: check CI on main." >&2; exit 1; fi
  sleep 10
done
echo "Waiting for CI on main at ${merge_sha:0:8}."
until result="$(read_api "repos/$repo/actions/workflows/ci.yml/runs?head_sha=$merge_sha&event=push" \
  --jq '[.workflow_runs[] | select(.status == "completed")] | sort_by(.created_at) | last | .conclusion // empty')"; [ -n "$result" ]; do
  if [ "$(date +%s)" -ge "$main_deadline" ]; then echo "CI on main at ${merge_sha:0:8} has not finished in an hour: look at it." >&2; exit 1; fi
  sleep 60
done
if [ "$result" != success ]; then echo "#$pr merged, but CI on main at ${merge_sha:0:8} is $result: fix main before anything else lands." >&2; exit 1; fi
echo "CI on main passed at ${merge_sha:0:8}."
