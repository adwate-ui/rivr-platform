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
- **CI runs as parallel jobs:** `code`, `database`, `storybook`, `mutation 1/6`–`6/6` (shares of the money files, balanced by size; `mutation score` then checks each module over every share's report, #515; a share runs Stryker without its run-wide break, since a share holds parts of several modules, and `mutation score` holds each whole module to the same 80) and `e2e 1/3`–`3/3` (one local stack per runner), plus `budgets` and `security`. `ci-ok` passes only when all of them did. A new or split job goes into `ci-ok`'s `needs`, never into branch protection.
- **Timeouts and caching.** Each timeout is near twice the job's usual time, so a hang fails fast. CI restores no build cache, so a green run is a result from scratch.
- **Speed.** `land.sh` prints each job's time after a merge. A job over 15 minutes is a cause to find before the next pull request. It then waits for CI on main at the merge and fails if that is not green.
- **Flaky tests.** A flaky test still fails the run (`.claude/rules/testing.md`); CI never retries one into green.
- **Flows that share state.** The flows tagged `@practice-cage` (End of day, Cage shift, Paper fallback) share the practice cage's one shift, so they run together, in file order, on a fourth runner. The shards were hiding that coupling.
- **Reviewed head only.** `land.sh` stops if a PR's head moves by anything but GitHub's merge of main onto the reviewed head. It stops on a cancelled check, and after two hours.
- **Mutation scope.**
  - The money modules are the folders `stryker.config.mjs` mutates: one list. Before this, `ledger`, `points`, `league` and `tally` were never mutated in CI.
  - A PR mutates only the modules it changes. A changed module's tests also kill the mutants of modules it imports, nearly always `money`, so a change can move `money`'s score. Mutating `money` on every such PR took longer than the rest of CI together. That effect is caught by the push to main, which mutates every module and must be green before a release.
  - A change to the testing helpers mutates them all.
- **Every main commit is checked.** Each push to main has a CI run of its own, never cancelled (since 0254, a newer commit's run replaces an older one, and every module is mutated in the full run every three hours). `release.yml` refuses a tag whose commit's push run on main did not succeed.
