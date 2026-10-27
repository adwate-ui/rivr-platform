# 0255: A pull request runs the CI jobs its changes need

Date: 2026-10-27 · Owner's decision ("fewer jobs only": no self-hosted or paid runners). Follows 0243 and 0254.

**Why.** The account runs 20 jobs at once, and every pull request ran all of CI's jobs, about 17, whatever it changed: a change to the player app ran pgTAP, one to SQL the twelve-minute Storybook visual tests. `verify.mjs` already knew what each kind of change needs (its local `changed` mode); CI did not use it.

**What.**
- A `plan` job (`verify.mjs plan`) measures the pull request's changes from its target (`PR_BASE`) and says which jobs it needs:
  - `database` for `supabase/`, `packages/db/` or a golden file;
  - `storybook` for `packages/ui/`, `packages/tokens/` or `packages/i18n/`;
  - `e2e` for `apps/`, `packages/`, `supabase/`, `e2e/` or the Playwright config;
  - `budgets` for the player app or `packages/`;
  - `mutate` for a money module, as before (0242).
- `code` checks only the affected packages and their dependents (Turbo `--affected` from `PR_BASE`). `security` always runs: it scans every file for secrets.
- A change to shared tooling (`TOOLING` in `verify.mjs`) or to `.github/` needs every job.
- Main's runs need every job; a push to main mutates nothing (0254).
- `ci-ok` passes a skipped job only when the plan, itself passed, said the run did not need it.
