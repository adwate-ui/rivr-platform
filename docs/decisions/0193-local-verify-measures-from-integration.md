# 0193: Local verify measures a branch's changes from integration

Date: 2026-10-26

**Why.** Task branches start from `integration`, which runs ahead of `main` until the next release cut (2–3 a day). `pnpm verify` measured changes from `main`, so a branch counted every task integrated since the last cut as its own change. Any of them touching `scripts/` or root tooling made it verify everything, mutation tests on all fourteen money modules included: about 25 minutes a run, and two at once overloaded the machine.

**What.** `scripts/verify.mjs` takes the merge base with `origin/integration` first, then `origin/main`, then `main`. A branch's local run checks its own changes; CI's full suite (`verify:all`) on every release cut still checks everything.
