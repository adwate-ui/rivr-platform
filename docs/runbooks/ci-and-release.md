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
| `e2e-staging` | `release-*` tags only | `E2E_SIGN_IN_CODE`: the private code staging's test numbers take, so the release's sign-in flow can sign in. Without it that flow fails. |
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

- Turn the email provider off entirely (Authentication → Sign In / Providers → Email), not only email sign-up. Auth records any verified email code or magic link as a code sign-in, which the access-token hook below accepts.
- Turn phone confirmations on ("Confirm phone"). Without it, Auth confirms a phone at a password sign-up without sending a code, and with the access-token hook on, a new member's first code request fails.
- Set the rate limits from `[auth.rate_limit]` in `supabase/config.template.toml`.
- Expose only the `public` and `graphql_public` schemas, never `private`.
- On staging, add every seed phone number (`supabase/seed/10_people.sql`) as a test number, so a seed sign-in never sends a real SMS. Give them a private code kept outside the repository, never the local `123456`: the seed includes super admins, and anyone who knows the code could sign in as one. Production has no test numbers. `scripts/ci/check-auth-config.mjs` checks both (#229): a release fails if production lists any test number, and the staging deploy warns about any test number that is not a seed number.
- Never run `supabase config push` against staging or production. The generated `config.toml` carries the local hook address, a local secret and the seed's `123456` test numbers.
- Sign-in codes (decision 0025), in this order:
  1. Make sure the `auth-send-code` function is deployed: the staging deploy does it, or a release does for production.
  2. Under Authentication → Hooks, add a **Send SMS** hook of type HTTPS pointing to `https://<project-ref>.supabase.co/functions/v1/auth-send-code`, and generate its secret.
  3. Under Edge Functions → Secrets, set `SEND_SMS_HOOK_SECRET` to that same secret.
  4. Add the access-token hook (#187). It refuses every session not started by a code, except a paired dealer tablet's or TV's own login (#41, decision 0045); without it, a password set on a number before its owner's first sign-in opens that account.
     - First make sure a deploy has applied migration `20261018091200_code_sign_in_only.sql`. A hook pointing at a function that does not exist fails every sign-in and every refresh.
     - Under Authentication → Hooks, add a **Customize Access Token (JWT) Claims** hook of type Postgres, schema `private`, function `require_code_sign_in`. If the dashboard does not offer the `private` schema, set it through the Management API (`hook_custom_access_token_uri` = `pg-functions://postgres/private/require_code_sign_in`).
     - Check it: sign in with a test number (staging) and refresh the session.
     - On staging, once, end the sessions that were not started by a code, in the SQL editor: `delete from auth.sessions s where not exists (select 1 from auth.mfa_amr_claims c where c.session_id = s.id and c.authentication_method = 'otp');`
     - The deploy checks it from then on (`scripts/ci/check-auth-config.mjs`): while phone sign-in is on, a gap is a warning on staging and fails a production release.
  5. Under Authentication → Sign In / Providers → Phone, turn phone sign-in on. It needs both hooks in place. On production, not before the CAPTCHA (#182) is live: without it, about 30 requests an hour to random numbers use up the project's code limit and lock every member out.
  6. Once WhatsApp is approved:
     - In Meta's dashboard, approve the authentication template `sign_in_code` in English, under the language code `en` (RIVR is English only, decision 0027).
     - Set `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` as function secrets. Use a system user's token scoped to `whatsapp_business_messaging` for this one business account; every function in the project can read the secrets.
     - Until a channel is set, every sign-in except the test numbers is refused.
  7. SMS through MSG91 (#181), for numbers not on WhatsApp and for every second code within ten minutes:
     - Register the sign-in template on the DLT portal under RIVR's entity and header, with the code as its one variable, then create an MSG91 OTP template on it.
     - In MSG91, create an auth key for this function alone, and turn off IP security on it, or the calls fail: Supabase Edge Functions have no fixed address.
     - Set a low-balance alert and a daily credit cap in MSG91: each code to a number that asks again costs a message.
     - Set `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` as function secrets. To rotate the key, create the new one, set it as the secret, then delete the old one in MSG91.
     - Check it: on staging, request a code for a number not on WhatsApp, then tap "Send by SMS"; the SMS arrives.
  - To rotate the hook secret: add the new secret in the hook settings (Auth accepts several, separated by `|`), set `SEND_SMS_HOOK_SECRET` to the new one, then remove the old one from the hook.
  - CAPTCHA on code requests (#182). Without it, anyone can use up the project-wide hourly code limit with requests to random numbers, which locks every member out of sign-in. In this order, staging first:
    1. In Cloudflare, add a Turnstile widget (Managed mode) with the exact hostnames: the player and console Pages projects (`rivr-player.pages.dev`, `rivr-console.pages.dev` and their staging projects; each also covers its preview subdomains) and the production domains. Never a bare `pages.dev`, which would let every Pages site use the key. Note the site key and secret.
    2. In GitHub, set the variables `STAGING_TURNSTILE_SITE_KEY` and `PROD_TURNSTILE_SITE_KEY` to the site key, and run the deploy. Check that the sign-in steps load the widget. Auth ignores the token while its CAPTCHA is off, so sign-in keeps working.
    3. Only then, in Supabase under Authentication → Attack Protection, turn CAPTCHA protection on with the provider Turnstile and the secret.
    4. Check that a sign-in still works.
  - The hourly code limit: under Authentication → Rate Limits, set "SMS messages" for launch day, for example 300 an hour on production (about 150 members and staff signing in twice). When Auth refuses codes for this limit (`over_sms_send_rate_limit`), the sign-in screen raises one `auth.sms_rate_limit` alert for the owner dashboard, at most every 15 minutes (`sign-in-alert`).

Outbox consumers (#215, decision 0038), on staging and production, once:

- pg_cron runs each consumer's Edge Function every minute through `private.run_outbox_consumer`, which reads the project's address and the scheduler's secret from Vault at each run. Until both are there, a run does nothing, and no consumer runs. It never sends the service-role key.
- Make a secret on your own computer: `openssl rand -hex 32`. Keep it only as long as these steps take.
- On the Vault page (Project Settings → Vault, or Integrations → Vault), add `project_url` = `https://<project-ref>.supabase.co`, and `outbox_scheduler_secret` = the secret. Use the Vault page, not the SQL editor, which keeps what is typed in it.
- Under Edge Functions → Secrets, set `OUTBOX_SCHEDULER_SECRET` to the same secret.
- To rotate it, change both to a new secret, the Edge Function secret first. Runs refused in between are tried again the next minute.
- Check it: `select jobname, schedule from cron.job;` lists `outbox-<function>` for each consumer, and `select status_code, created from net._http_response order by created desc limit 5;` shows 200s.

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
