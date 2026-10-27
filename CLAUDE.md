# RIVR platform

Software for RIVR, a members' poker club in Gurugram. Launch Sunday 15 Nov 2026. One Supabase backend, one domain library, one UI library, six apps: `player` (PWA), `console` (staff web), `tablet` (Android dealer tablet), `display` (TVs), `web` (public site), `driver` (Android).

Specification lives in `docs/spec/`; start with `docs/spec/README.md`, which sets the reading order and what is out of scope. The work queue is GitHub issues labelled by lane (see `docs/tasks/README.md`). Detailed standards live in `.claude/rules/` and load when you touch matching files.

## Commands

- `pnpm i` install · `pnpm dev --filter <app>` run one app
- `pnpm verify` everything CI runs, for changed packages only
- `pnpm verify:all` everything, for the whole repo
- `pnpm test --filter <pkg> -- <pattern>` one test file
- `pnpm e2e --grep "<flow name>"` one Playwright flow
- `pnpm supabase <cmd>` the Supabase CLI (a dev dependency) · `pnpm db:start` / `pnpm db:stop` local Supabase for this worktree · `pnpm db:reset` reapply migrations and seed
- `pnpm db:types` regenerate `packages/db` types after a migration
- `pnpm storybook --filter ui` · `pnpm visual` screenshot every story and compare

## Repository map

- `packages/tokens` `tokens.json`, the single design source, and its generated outputs. Nowhere else may hold a raw design value.
- `packages/ui` every visible element. Apps assemble it; they never style.
- `packages/domain` every business rule (money, rake, call time, TDS, GST, priority, payouts, points). Pure TypeScript.
- `packages/db` the only code that talks to Supabase.
- `packages/contracts` Zod schemas shared by apps and Edge Functions.
- `packages/i18n` every user-facing string (English only) and the money/time formatters.
- `packages/adapters` one interface per vendor, each with a fake.
- `supabase/` migrations, Edge Functions, seed, pgTAP tests.

## Rules that apply everywhere

1. IMPORTANT: Every visible element comes from `@rivr/ui`. If it is missing, add it to `@rivr/ui` first (use the `new-ui-component` skill), then use it.
2. Business rules live only in `@rivr/domain`. A component, hook, view or Edge Function never computes money.
3. Money is integer paise (`bigint`) through `@rivr/domain/money`. Rake rounds down to ₹50.
4. Every table has `venue_id` and row-level security. The practice venue never reaches an external consumer.
5. External calls happen only in outbox consumers, through `@rivr/adapters`.
6. One way to do each thing. Before adding a pattern, search for the existing one and use it.
7. No abstraction until the third use. Prefer plain, obvious code a new junior developer can follow.
8. Every member-facing feature has a feature key and is gated by tier in the database (`has_feature`) and in the UI (`FeatureGate`). See "Tier-gated features" in `docs/spec/additions-2026-10-14.md`.
9. Never disable a lint rule, skip a test, lower a threshold, edit an applied migration or weaken a type to get green. If a rule is wrong, open a `question` issue.

## How to work a task

Use the `feature-task` skill. In short:

1. Take a batch of three or four ready issues from one area of the app (rewards, the floor, the website...), lowest-numbered first, on a fresh `batch/<area>` branch from `origin/main`, and claim them all (`docs/decisions/0257`). Batches run one at a time in the main checkout, in release-gate order (`docs/decisions/0024`).
2. Read the task's spec section and the files it names. Use plan mode when it touches more than one package.
3. Write the failing test first, from the task's acceptance criteria.
4. Implement in small steps. Run the narrowest test after each step.
5. For UI, screenshot the screen and compare it with `docs/design/prototype.html`. List differences and fix them.
6. Run `pnpm verify`. Paste the summary into the PR.
7. Ask the `reviewer` subagent to review the diff against the task, once. Add the `security-reviewer` only for auth, money or database policies. Fix correctness and requirement gaps; ignore style preferences the linters do not enforce.
8. Open one PR per batch with `gh pr create`, titled `type(scope): summary`, one commit per issue, and a body with a section per issue (its acceptance criteria and their evidence) and a `Closes #<issue>` line for each (`docs/decisions/0257`). Build only the acceptance criteria; polish and design nits become follow-up issues. An issue that stalls in review moves to the next batch rather than holding the others.
9. When the review passes, post `agent-review` with `scripts/github/post-agent-review.sh`, then run `scripts/github/land.sh <pr>` in the background: it merges once CI is green, re-running CI on main's latest only when both changed migrations or seed (decisions 0243, 0253). Then take the next batch.

Show evidence, not claims: the command you ran and its output, or the screenshot.

## Done means

- The task's acceptance criteria pass, end to end where a flow exists, with the evidence in the PR.
- Built only from `@rivr/ui` and `@rivr/i18n`, in English (Hindi is out of scope, decision 0027), with loading, empty and error states.
- Works on the target device: phone (player), dealer tablet, 1440 px (console), 1920 px (TV).
- Correct in the practice venue, and nothing from it reaches an external system.
- Package README updated; the PR closes its issue.

## When something is unclear

If it affects money, identity or a rule a player sees: open a `question` issue, take the safest reading, and continue. Otherwise decide, record it in `docs/decisions/NNNN-title.md` (five to fifteen lines), and continue.

## Gotchas

- Run everything inside WSL, never on the Windows filesystem.
- The local Supabase stack uses the checkout's port block (root 543xx; a gitignored `.rivr-port-block` overrides it on a machine where 543xx is taken) with Studio, analytics and mail disabled. Start it only for database work and stop it when done.
- Never touch `rivr-prod`. Only CI deploys.
- Regenerate types (`pnpm db:types`) after every migration or the build will lie to you.
- When compacting, keep the task id, the files changed and the verification command.
