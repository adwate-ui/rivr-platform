# CI and release

All workflows run on GitHub-hosted runners (`docs/decisions/0001-hosted-ci-runners.md`).

| Workflow | When | What |
|---|---|---|
| `ci.yml` | Every PR and push to `main` | Four required jobs. `verify` runs `pnpm verify:all`. `e2e` runs the Playwright flows against a seeded local stack. `budgets` checks player initial JavaScript is under 200 KB gzipped. `security` runs `supabase db lint`, the Supabase security advisors, `pnpm audit` and gitleaks. |
| `preview.yml` | Every PR from this repository | Builds every web surface against staging data and deploys a Cloudflare Pages preview per app (`pr-<n>` branch of `rivr-<app>-staging`). |
| `deploy-staging.yml` | Every merge to `main` | Migrations and seed, Edge Functions, every web surface and Storybook to staging. |
| `release.yml` | A tag `release-YYYYMMDD-N` | End-to-end suite against staging, then the same commit to production (migrations without seed, Edge Functions, Pages), plus signed tablet and driver APKs attached to the GitHub release. |

Deploy jobs skip with a notice until their secrets exist, so `main` stays green before the accounts are set up.

## Secrets and variables

Set under Settings → Secrets and variables → Actions. Secrets are encrypted; variables are plain and visible (only non-secret values).

| Name | Kind | Used by |
|---|---|---|
| `SUPABASE_ACCESS_TOKEN` | secret | staging and production database deploys |
| `SUPABASE_STAGING_REF`, `SUPABASE_STAGING_DB_PASSWORD` | secret | staging |
| `SUPABASE_PROD_REF`, `SUPABASE_PROD_DB_PASSWORD` | secret | production |
| `CLOUDFLARE_API_TOKEN` (Pages edit), `CLOUDFLARE_ACCOUNT_ID` | secret | previews, staging, production |
| `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD` | secret | release APKs |
| `SENTRY_AUTH_TOKEN`, `SENTRY_DSN` | secret | when Sentry is wired in |
| `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY` | variable | builds for previews and staging |
| `PROD_SUPABASE_URL`, `PROD_SUPABASE_PUBLISHABLE_KEY` | variable | production builds |
| `STAGING_{PLAYER,CONSOLE,TABLET,DISPLAY,DRIVER,WEB}_URL` | variable | the release's end-to-end run against staging |
| `PROD_TABLET_URL`, `PROD_DRIVER_URL` | variable | the hosted bundle the APK shells load |

The production jobs use a GitHub environment named `production`; add required reviewers there if a person should approve each release.

## Releasing

1. Confirm the day's `main` is green and staging looks right.
2. `git tag release-20261115-1 <commit> && git push origin release-20261115-1` (a person does this; agents cannot push tags to production).
3. Watch the Release workflow. If the staging e2e run fails, nothing reaches production.

## Rolling back

- Web: Cloudflare Pages → the project → Deployments → roll back to the previous production deployment.
- Database: never revert a migration in production. Write a forward-fix migration and release it.
- Tablets: the APK loads the hosted bundle, so a Pages rollback rolls the tablets back too.

## First-time repository setup

Run `scripts/github/setup-repo.sh` once with admin rights: labels, branch protection on `main` (requires `verify`, `e2e`, `budgets`, `security` and `agent-review`), squash-only merges, and approval for workflows from outside contributors.
