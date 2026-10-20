#!/usr/bin/env bash
# One-time GitHub setup for the repository (run by a person with admin rights):
#   1. the task labels from docs/tasks/README.md
#   2. branch protection on main: CI's four jobs and the agent-review status are required,
#      merges are squash-only, no force pushes, no deletion
#   3. Actions on pull requests from outside contributors wait for approval
#   4. the preview, staging and production environments, and release-* tags for admins only
# Safe to run again. Usage: scripts/github/setup-repo.sh [owner/repo]
set -euo pipefail
repo="${1:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

label() { gh label create "$1" --repo "$repo" --color "$2" --description "$3" --force >/dev/null; echo "label $1"; }
label 'lane:a' 'c9a85c' 'Lane A: money (ledger, cage, wallet, markers, TDS, GST, Tally)'
label 'lane:b' '0e3b2c' 'Lane B: floor (tables, waitlist, tablet, tournaments, jackpots, TVs)'
label 'lane:c' 'f3ede0' 'Lane C: member and web (PWA, KYC, website, Learn, cab)'
label 'lane:d' 'c4162a' 'Lane D: growth and content (renderer, social, outbox consumers)'
label 'status:todo' 'ededed' 'Ready to be taken once its dependencies are closed'
label 'status:doing' 'fbca04' 'Being worked on now'
label 'status:review' '0075ca' 'PR open, waiting for review and CI'
label 'question' 'd876e3' 'A decision the owner answers'
label 'release:A' '5319e7' 'Release A, 30 Oct'
label 'release:training' '1d76db' 'Training on the floor stack, 1 Nov'
label 'release:freeze' 'b60205' 'Feature freeze, 10 Nov'

gh api --method PUT "repos/$repo/branches/main/protection" --input - >/dev/null <<'JSON'
{
  "required_status_checks": { "strict": false, "contexts": ["verify", "e2e", "budgets", "security", "agent-review"] },
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

# Deploy environments. Secrets live in an environment, never at repository level, so a job gets
# only its environment's keys:
#   preview     pull requests; a Cloudflare token for the staging account only
#   staging     main only; staging Supabase and Cloudflare
#   production  release-* tags only, and the repository owner approves each release
#   e2e-staging release-* tags only; the staging test numbers' sign-in code for the release's e2e run
#   backup-staging, backup-production  main only; the nightly backup's database URL and bucket keys (#25), and the
#                                      project's Storage S3 key, to copy its files (#386)
owner_id="$(gh api "users/${repo%%/*}" --jq .id)"
environment() {
  gh api --method PUT "repos/$repo/environments/$1" --input - >/dev/null
  echo "environment $1"
}
deploy_only_from() {
  # Refused when the policy already exists, which is fine on a re-run.
  gh api --method POST "repos/$repo/environments/$1/deployment-branch-policies" -f name="$2" -f type="$3" >/dev/null 2>&1 || true
}
echo '{}' | environment preview
echo '{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}' | environment staging
deploy_only_from staging main branch
cat <<JSON | environment production
{
  "reviewers": [{ "type": "User", "id": $owner_id }],
  "deployment_branch_policy": { "protected_branches": false, "custom_branch_policies": true }
}
JSON
deploy_only_from production 'release-*' tag
echo '{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}' | environment e2e-staging
deploy_only_from e2e-staging 'release-*' tag
for target in staging production; do
  echo '{"deployment_branch_policy": {"protected_branches": false, "custom_branch_policies": true}}' | environment "backup-$target"
  deploy_only_from "backup-$target" main branch
done

# Only repository admins create, move or delete release-* tags.
if ! gh api "repos/$repo/rulesets" --jq '.[].name' | grep -qx 'release tags'; then
  gh api --method POST "repos/$repo/rulesets" --input - >/dev/null <<'JSON'
{
  "name": "release tags",
  "target": "tag",
  "enforcement": "active",
  "bypass_actors": [{ "actor_id": 5, "actor_type": "RepositoryRole", "bypass_mode": "always" }],
  "conditions": { "ref_name": { "include": ["refs/tags/release-*"], "exclude": [] } },
  "rules": [{ "type": "creation" }, { "type": "update" }, { "type": "deletion" }]
}
JSON
fi
echo "release-* tags: admins only"
