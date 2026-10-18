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

Secrets live in GitHub environments (Settings → Environments), never at repository level, so each job holds only its own environment's keys. `scripts/github/setup-repo.sh` creates the environments; a person adds the values.

| Environment | Who can use it | Secrets |
|---|---|---|
| `preview` | pull requests from this repository | `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for the **staging** Cloudflare account. Never the production token: any branch can run this job. |
| `staging` | `main` only | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_STAGING_REF`, `SUPABASE_STAGING_DB_PASSWORD`, and the staging `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` |
| `production` | `release-*` tags only, after the repository owner approves | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROD_REF`, `SUPABASE_PROD_DB_PASSWORD`, the production `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, and `SENTRY_AUTH_TOKEN` and `SENTRY_DSN` when Sentry is wired in |

Staging and production use separate Cloudflare accounts, or at least tokens scoped to their own projects, so a preview token can never deploy production.

Variables are plain and visible, so they hold only non-secret values (Settings → Secrets and variables → Actions → Variables):

| Name | Used by |
|---|---|
| `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY` | builds for previews and staging |
| `PROD_SUPABASE_URL`, `PROD_SUPABASE_PUBLISHABLE_KEY` | production builds |
| `STAGING_{PLAYER,CONSOLE,TABLET,DISPLAY,DRIVER,WEB}_URL` | the release's end-to-end run against staging |
| `PROD_TABLET_URL`, `PROD_DRIVER_URL` | the hosted bundle the APK shells load |

Auth and API on staging and production, in the Supabase dashboard:

- Turn email sign-up off.
- Turn phone confirmations on ("Confirm phone"). Without it, Auth confirms a phone at a password sign-up without sending a code, and `link_my_login` refuses such logins anyway.
- Set the rate limits from `[auth.rate_limit]` in `supabase/config.template.toml`.
- Expose only the `public` and `graphql_public` schemas, never `private`.
- On staging, add every seed phone number (`supabase/seed/10_people.sql`) as a test number, so a seed sign-in never sends a real SMS. Give them a private code kept outside the repository, never the local `123456`: the seed includes super admins, and anyone who knows the code could sign in as one. Production has no test numbers.
- Never run `supabase config push` against staging or production. The generated `config.toml` carries the local hook address, a local secret and the seed's `123456` test numbers.
- Sign-in codes (decision 0025), in this order:
  1. Make sure the `auth-send-code` function is deployed: the staging deploy does it, or a release does for production.
  2. Under Authentication → Hooks, add a **Send SMS** hook of type HTTPS pointing to `https://<project-ref>.supabase.co/functions/v1/auth-send-code`, and generate its secret.
  3. Under Edge Functions → Secrets, set `SEND_SMS_HOOK_SECRET` to that same secret.
  4. Under Authentication → Sign In / Providers → Phone, turn phone sign-in on. It needs the hook in place. On production, not before the CAPTCHA (#182) is live: without it, about 30 requests an hour to random numbers use up the project's code limit and lock every member out.
  5. Once WhatsApp is approved:
     - In Meta's dashboard, approve the authentication template `sign_in_code` in both `en` and `hi`, under exactly those language codes.
     - Set `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` as function secrets. Use a system user's token scoped to `whatsapp_business_messaging` for this one business account; every function in the project can read the secrets.
     - Until a channel is set, every sign-in except the test numbers is refused.
  - To rotate the hook secret: add the new secret in the hook settings (Auth accepts several, separated by `|`), set `SEND_SMS_HOOK_SECRET` to the new one, then remove the old one from the hook.
  - CAPTCHA on code requests, and the hourly code limit, are issue #182.

## Releasing

1. Confirm the day's `main` is green and the staging deploy of the commit you will release succeeded. The release refuses a commit that is not on `main` or that staging is not running.
2. `git tag release-20261115-1 <commit> && git push origin release-20261115-1`. Only repository admins can create `release-*` tags; agents never do. N runs from 1 to 99 per day, and the APK version code is YYYYMMDD × 100 + N.
3. Approve the `production` deployment when the Release workflow asks. If the staging e2e run fails, nothing reaches production.

## Rolling back

- Web: Cloudflare Pages → the project → Deployments → roll back to the previous production deployment.
- Database: never revert a migration in production. Write a forward-fix migration and release it.
- Tablets: the APK loads the hosted bundle, so a Pages rollback rolls the tablets back too.

## First-time repository setup

Run `scripts/github/setup-repo.sh` once with admin rights: labels, branch protection on `main` (requires `verify`, `e2e`, `budgets`, `security` and `agent-review`), squash-only merges, approval for workflows from outside contributors, the three environments and the `release-*` tag rule. Safe to run again.
