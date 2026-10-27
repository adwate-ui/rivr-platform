# 0243: Pull requests go straight to main, up to date and green; CI runs as parallel jobs behind one gate

Date: 2026-10-27 · Owner's decision: two builders (the lead agent and one builder) and "best in class CI". Supersedes 0193 (the `integration` branch and release cuts).

**Why.** The `integration` branch and release cuts were made for several builders and an hour-long CI.
- Every task was handled twice, and a cut of 3 to 9 tasks was held back whole by one failure.
- Finished work sat unseen on `integration`.
- CI's `verify` had grown from 21 to 58 minutes against a 60-minute limit.
- Admins, which both agents act as, could bypass branch protection.

The repository belongs to a personal account, so GitHub's merge queue is not available.

**What.**
- **Branching.** Each task, or a few closely related ones, is a branch from `main` and a pull request to `main`. Once its local verify and reviews pass, `scripts/github/land.sh` turns on auto-merge (squash) and keeps the branch up to date with `main` until GitHub merges it. So every merge has passed CI against the `main` it lands on.
- **Branch protection** (`scripts/github/setup-repo.sh`) requires `ci-ok` and `agent-review`, requires a pull request to be up to date with `main`, and holds admins to it too. `agent-review` is posted again after an update from `main`, because the reviewed diff has not changed.
- **CI runs as parallel jobs:** `code`, `database`, `storybook`, `mutation 1/4`–`4/4` and `e2e 1/3`–`3/3` (one local stack per runner), plus `budgets` and `security`. `ci-ok` passes only when all of them did. A new or split job goes into `ci-ok`'s `needs`, never into branch protection.
- **Timeouts and caching.** Each timeout is near twice the job's usual time, so a hang fails fast. CI restores no build cache, so a green run is a result from scratch.
- **Speed.** `land.sh` prints each job's time after a merge. A job over 15 minutes is a cause to find before the next pull request.
- **Flaky tests.** A flaky test still fails the run (`.claude/rules/testing.md`); CI never retries one into green.
