#!/usr/bin/env bash
# Lands a pull request on main (decisions 0243 and 0253). Run it once the pull request's local verify and reviews
# passed and post-agent-review.sh posted agent-review on the reviewed head. It squash-merges once the required checks
# pass, as they passed: a pull request is not re-run because main moved. Only when it and main, since the branch left
# it, both changed migrations or seed does GitHub merge main into it and CI run again, with agent-review posted again
# on that merge (an update from main leaves the reviewed diff as it was): two migrations must not share a version and
# must apply together, and seed rows share ids. It merges nothing while the newest CI run on main has not passed,
# except the pull request that fixes main (--fixes-main). It stops if the head moves any other way (a push nobody
# reviewed), on a failed or cancelled required check, on a conflict, or after two hours. Once merged it prints each CI
# job's time (a job over 15 minutes is a cause to find before the next pull request), then waits for CI on main at the
# merge and fails if it is not green: that run catches whatever two pull requests break together. A newer commit's run
# replaces it and tests this one too (decision 0254).
#   scripts/github/land.sh <pr-number> [--fixes-main]
set -euo pipefail

pr="${1:?pull request number}"
fixes_main="${2:-}"
[[ "$pr" =~ ^[0-9]+$ ]] || { echo "The pull request number must be digits." >&2; exit 1; }
[ -z "$fixes_main" ] || [ "$fixes_main" = --fixes-main ] || { echo "The only option is --fixes-main." >&2; exit 1; }
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
# Every check branch protection requires has passed: ci-ok is listed only once its jobs are done.
checks_passed() {
  local required passed
  required="$(read_api "repos/$repo/branches/main/protection/required_status_checks" --jq '.contexts | sort | join(",")')"
  passed="$( (gh pr checks "$pr" --required 2>/dev/null || true) | awk -F'\t' '$2 == "pass" { print $1 }' | LC_ALL=C sort -u | paste -sd, -)"
  [ -n "$required" ] && [ "$passed" = "$required" ]
}
# The newest finished run on main of the events given, newest commit first; one a newer commit's run replaced says
# nothing (decision 0254). A pull request's run never counts, a fork's from its own main included.
newest_on_main() {
  read_api "repos/$repo/actions/workflows/ci.yml/runs?branch=main&status=completed&per_page=50" \
    --jq "[.workflow_runs[] | select(.conclusion != \"cancelled\" and ($1))][0].conclusion // empty"
}
# Main has passed: its newest push run, and its newest full run, the only one that mutates every money module. Empty
# when GitHub cannot be read; until a full run has finished, the push run's alone.
main_ci() {
  local push full
  push="$(newest_on_main '.event == "push"')"
  full="$(newest_on_main '.event == "schedule" or .event == "workflow_dispatch"')"
  if [ -z "$push" ] || [ "$push" != success ]; then echo "$push"; return; fi
  if [ -n "$full" ] && [ "$full" != success ]; then echo "$full in the full run"; return; fi
  echo success
}
# Whether the pull request and main, since the commit left it, both changed migrations or seed: 0 when they did, 1 when
# not, 2 when GitHub could not be read. A comparison lists at most 300 files, so a full list counts as a clash.
db_clash() {
  local main_files pr_files
  main_files="$(gh api "repos/$repo/compare/$1...main" \
    --jq 'if (.files | length) >= 300 then "supabase/migrations/ (300 files or more)" else .files[].filename end' 2>/dev/null)" || return 2
  pr_files="$(gh api --paginate "repos/$repo/pulls/$pr/files" --jq '.[].filename' 2>/dev/null)" || return 2
  grep -qE '^supabase/(migrations|seed)/' <<<"$main_files" && grep -qE '^supabase/(migrations|seed)/' <<<"$pr_files"
}
told_red=''
# Merges the reviewed head unless main has meanwhile gained a database change too, or the newest CI run on main has not
# passed. One merge at a time on this machine (both builders' worktrees share /tmp), so two database changes cannot
# both pass the check; a lock held five minutes is left for the next round.
merge_now() {
  local clash=0 main
  exec 9>/tmp/rivr-land.lock
  flock -w 300 9 || return 0
  db_clash "$1" || clash=$?
  main="$(main_ci)"
  if [ "$main" = success ] || [ -n "$fixes_main" ]; then told_red=''; fi
  if [ "$main" != success ] && [ -z "$fixes_main" ]; then
    if [ -n "$main" ] && [ -z "$told_red" ]; then
      echo "#$pr: waiting, the newest CI run on main is $main: fix main first, landing the fix with --fixes-main." >&2
      told_red=yes
    fi
  elif [ "$clash" = 1 ] && ! gh pr merge "$pr" --squash --match-head-commit "$1" >/dev/null 2>&1; then
    if [ "$(read_api "repos/$repo/pulls/$pr" --jq .mergeable_state)" = dirty ]; then
      echo "#$pr conflicts with main: merge main into the branch, re-run verify, push, review, run this again." >&2
      exit 1
    fi
    if [ "$(read_api "repos/$repo/branches/main/protection/required_status_checks" --jq .strict)" = true ]; then
      echo "Branch protection still requires a pull request up to date with main: turn that off (setup-repo.sh, decision 0253)." >&2
      exit 1
    fi
  fi
  flock -u 9
}
in_time() {
  [ "$(date +%s)" -lt "$deadline" ] && return
  if [ -n "$told_red" ]; then echo "#$pr: not merged after two hours: CI on main has not passed; land its fix with --fixes-main." >&2
  else echo "#$pr: not merged after two hours; look at its checks." >&2; fi
  exit 1
}

expected="$(head_sha)"
IFS=$'\t' read -r review reason <<<"$(review_of "$expected")"
[ "${review:-}" = success ] || { echo "agent-review is not success on #$pr's head: post it once the reviews pass." >&2; exit 1; }
# This script merges, after its own checks; auto-merge would merge a green pull request without them.
gh pr merge "$pr" --disable-auto >/dev/null 2>&1 || true

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
  clash=1
  if [ "${behind:-0}" -gt 0 ]; then db_clash "$head" || clash=$?; fi
  if [ "$clash" = 2 ]; then sleep 30; continue; fi
  if [ "$clash" = 0 ]; then
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
  if checks_passed; then merge_now "$expected"; fi
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

# Main's own run after the merge catches what two pull requests break together, and the full run every three hours a
# change to one module's tests that moves another's score (decision 0254). A red main is fixed before anything else
# lands: a fix landed with --fixes-main starts the full run at once, so merges need not wait for the next one.
main_deadline=$(($(date +%s) + 3600))
until merge_sha="$(read_api "repos/$repo/pulls/$pr" --jq '.merge_commit_sha // empty')"; [ -n "$merge_sha" ]; do
  if [ "$(date +%s)" -ge "$main_deadline" ]; then echo "#$pr merged, but its merge commit could not be read: check CI on main." >&2; exit 1; fi
  sleep 10
done
if [ -n "$fixes_main" ]; then
  if gh workflow run ci.yml --ref main >/dev/null 2>&1; then echo "Started CI's full run on main."
  else echo "Could not start CI's full run on main: start it (gh workflow run ci.yml --ref main), or merges wait for the next." >&2; fi
fi
echo "Waiting for CI on main at ${merge_sha:0:8}."
until result="$(read_api "repos/$repo/actions/workflows/ci.yml/runs?head_sha=$merge_sha&event=push" \
  --jq '[.workflow_runs[] | select(.status == "completed")] | sort_by(.created_at) | last | .conclusion // empty')"; [ -n "$result" ]; do
  if [ "$(date +%s)" -ge "$main_deadline" ]; then echo "CI on main at ${merge_sha:0:8} has not finished in an hour: look at it." >&2; exit 1; fi
  sleep 60
done
if [ "$result" = cancelled ]; then echo "CI on main at ${merge_sha:0:8} gave way to a newer commit's run, which tests it too."; exit 0; fi
if [ "$result" != success ]; then echo "#$pr merged, but CI on main at ${merge_sha:0:8} is $result: fix main before anything else lands." >&2; exit 1; fi
echo "CI on main passed at ${merge_sha:0:8}."
