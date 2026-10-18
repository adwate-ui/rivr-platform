#!/usr/bin/env bash
# One-time GitHub setup for the repository (run by a person with admin rights):
#   1. the task labels from docs/tasks/README.md
#   2. branch protection on main: CI's four jobs and the agent-review status are required,
#      merges are squash-only, no force pushes, no deletion
#   3. Actions on pull requests from outside contributors wait for approval
# Safe to run again. Usage: scripts/github/setup-repo.sh [owner/repo]
set -euo pipefail
repo="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

label() { gh label create "$1" --repo "$repo" --color "$2" --description "$3" --force >/dev/null; echo "label $1"; }
label 'lane:a' 'c9a85c' 'Lane A: money (ledger, cage, wallet, markers, TDS, GST, Tally)'
label 'lane:b' '0e3b2c' 'Lane B: floor (tables, waitlist, tablet, tournaments, jackpots, TVs)'
label 'lane:c' 'f3ede0' 'Lane C: member and web (PWA, KYC, website, Learn, Hindi, cab)'
label 'lane:d' 'c4162a' 'Lane D: growth and content (renderer, social, outbox consumers)'
label 'status:todo' 'ededed' 'Ready to be taken once its dependencies are closed'
label 'status:doing' 'fbca04' 'Claimed by a lane session'
label 'status:review' '0075ca' 'PR open, waiting for the reviewer session'
label 'question' 'd876e3' 'A decision the reviewer session answers'
label 'release:A' '5319e7' 'Release A, 30 Oct'
label 'release:training' '1d76db' 'Training on the floor stack, 1 Nov'
label 'release:freeze' 'b60205' 'Feature freeze, 10 Nov'

gh api --method PUT "repos/$repo/branches/main/protection" --input - >/dev/null <<'JSON'
{
  "required_status_checks": { "strict": true, "contexts": ["verify", "e2e", "budgets", "security", "agent-review"] },
  "enforce_admins": false,
  "required_pull_request_reviews": null,
  "restrictions": null,
  "required_linear_history": true,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": false
}
JSON
echo "branch protection on main"

gh api --method PATCH "repos/$repo" -F allow_squash_merge=true -F allow_merge_commit=false -F allow_rebase_merge=false -F delete_branch_on_merge=true >/dev/null
echo "squash merges only, branches deleted after merge"

gh api --method PUT "repos/$repo/actions/permissions/fork-pr-contributor-approval" -f approval_policy=all_external_contributors >/dev/null
echo "workflows from outside contributors need approval"
