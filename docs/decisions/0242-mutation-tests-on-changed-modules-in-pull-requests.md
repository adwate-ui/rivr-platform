# 0242: A pull request's CI mutates only the money modules it changes

Date: 2026-10-27 · Owner's question: why a release cut takes an hour to land

**Why.** CI's `verify` ran Stryker over every money module on every pull request. The command runner runs the whole domain suite once per mutant, so the step took 41 of the job's 57 minutes on cut #491 (2,445 s), every time, even for a cut with no domain change. The job's limit is 60 minutes.

**What.** On a pull request, CI sets `MUTATION_SINCE` to the target branch. `verify:all` then mutates only the money modules changed since it, the same as a local `pnpm verify`. It mutates every module when the pull request changes domain code outside a money module, a golden file, the lockfile, the root package or TypeScript config, or `packages/config`. The push to main still mutates every module. Thresholds are unchanged: break 80.

**Why this is safe.** A module's score depends on its source and its tests. If neither changed, it scores what it scored when main last passed.
