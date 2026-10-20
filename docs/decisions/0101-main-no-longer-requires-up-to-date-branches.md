# 0101: Main no longer requires a PR to be up to date with it before merging

Date: 2026-10-20 · The owner's call, with four builders working at once for the training release

Branch protection on `main` still requires `verify`, `e2e`, `budgets`, `security` and `agent-review` to
pass on every PR. It no longer requires the PR to include the latest main first ("strict").

With four builders, every merge made every other open PR stale, and each then needed another full CI
run, about 20 minutes, before it could merge. Merges queued behind one another at about three an hour.

The risk is two PRs that pass on their own but break together. CI also runs on `main` after every
merge, which shows that at once, and it is fixed forward. The merge script (`train-lib.sh`) still
brings a stale branch up to date if GitHub asks for it. `scripts/github/setup-repo.sh` sets the same
rule, so running it again keeps it.
