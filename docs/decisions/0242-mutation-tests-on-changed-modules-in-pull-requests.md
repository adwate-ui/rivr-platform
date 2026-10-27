# 0242: A pull request's CI mutates only the money modules it changes

Date: 2026-10-27 · Owner's question: why a release cut takes an hour to land

**Why.** CI's `verify` ran Stryker over every money module on every pull request. The command runner runs the whole domain suite once per mutant, so the step took 41 of the job's 57 minutes on cut #491 (2,445 s), every time, even for a cut with no domain change. The job's limit is 60 minutes.

**What.** On a pull request, CI sets `MUTATION_SINCE` to the target branch. `verify:all` then mutates only the money modules changed since it, the same as a local `pnpm verify`. A changed golden file also mutates the modules whose tests import it. Every module is mutated when the pull request changes any of these:
- domain code or config outside a money module (prose such as README does not count);
- the lockfile, the root package or TypeScript config, or `packages/config`.

The push to main still mutates every module, in a separate `mutation` job split four ways (`verify.mjs mutation <n>/4`, shares taken from the same module list), so it runs in about a quarter of the time instead of pushing `verify` past its 60-minute limit. Thresholds are unchanged: break 80.

**Watch.** The cut checklist now records the `verify`, `e2e` and `mutation` times, so a slow climb is seen early: `verify` went from 21 minutes on 26 Oct to 58 on 27 Oct without anyone noticing.

**Why this is safe.** A module's score depends on its source and its tests. If neither changed, it scores what it scored when main last passed.

**Correction (decision 0243).** Stryker's command runner runs the whole domain suite for every mutant, so a module's score also depends on other modules' tests, `money`'s most of all. The push to main, which mutates every module and must be green before a release, catches that.
