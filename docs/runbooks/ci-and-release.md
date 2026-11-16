# CI and release

All workflows run on GitHub-hosted runners (`docs/decisions/0001-hosted-ci-runners.md`).

| Workflow | When | What |
|---|---|---|
| `ci.yml` | Every PR and push to `main` | Parallel jobs (decision 0243): `code` (typecheck, lint, unit and property tests, root lint, import maps, migration versions, dependency rules, stylesheets, tokens), `database` (pgTAP and generated types), `storybook` (build and visual tests), `mutation 1/14`–`14/14` (a pull request's changed money modules; every module on `main`, decision 0242; each a share of the modules' files, balanced by size, #515; fourteen shares since decision 0425), `mutation score` (each module's score over every share's report, 80 or more); `mutation plan` first, and a pull request with no money file to mutate starts none of them, `e2e 1/3`–`3/3` (the Playwright flows against a seeded local stack, one stack per runner), `budgets` (player initial JavaScript under 200 KB gzipped) and `security` (`supabase db lint`, the Supabase security advisors, the nightly backup against the local stack as its read-only role (`scripts/backup/check-backup.sh`), `pnpm audit` and gitleaks). `ci-ok` passes only when every job passed; it is the one CI check branch protection requires. |
| `nightly-backup.yml` | 08:00 IST daily, or by hand | For staging and production: an encrypted logical dump and CSV export to the target's R2 bucket. Skips until its environment is set up. See `docs/runbooks/backups-and-restore.md`. |
| `preview.yml` | Every PR from this repository | Builds every web surface against staging data and deploys a Cloudflare Pages preview per app (`pr-<n>` branch of `rivr-<app>-staging`). |
| `deploy-staging.yml` | Every merge to `main` | Migrations and seed, Edge Functions, every web surface and Storybook to staging. |
| `release.yml` | A tag `release-YYYYMMDD-N` | The tagged commit's web apps on a staging preview alias named after the tag, the end-to-end flows tagged `@staging` against them (decisions 0420, 0422), then the same commit to production (migrations without seed, Edge Functions, Pages), plus the signed tablet APK attached to the GitHub release. |

Deploy jobs skip with a notice until their secrets exist, so `main` stays green before the accounts are set up.

## Secrets and variables

Secrets live in GitHub environments (Settings → Environments), never at repository level, so each job holds only its own environment's keys. `scripts/github/setup-repo.sh` creates the environments; a person adds the values.

| Environment | Who can use it | Secrets |
|---|---|---|
| `preview` | pull requests from this repository | `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` for the **staging** Cloudflare account. Never the production token: any branch can run this job. |
| `staging` | `main` only | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_STAGING_REF`, `SUPABASE_STAGING_DB_PASSWORD`, the staging `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, and `SENTRY_AUTH_TOKEN` for uploading source maps (decision 0672) |
| `e2e-staging` | `release-*` tags only | `E2E_SIGN_IN_CODE`: the private code staging's test numbers take, so the release's sign-in flow can sign in. Without it that flow fails. |
| `backup-staging`, `backup-production` | `main` only (the nightly backup, #25) | `BACKUP_DB_URL` (the read-only `rivr_backup` role, never `postgres`), plus `BACKUP_S3_ACCESS_KEY_ID` and `BACKUP_S3_SECRET_ACCESS_KEY` for that target's own bucket. Variables: `BACKUP_S3_ENDPOINT`, `BACKUP_BUCKET` and `BACKUP_AGE_RECIPIENT`. See `docs/runbooks/backups-and-restore.md`. |
| `production` | `release-*` tags only, after the repository owner approves | `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROD_REF`, `SUPABASE_PROD_DB_PASSWORD`, the production `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`, `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`, and `SENTRY_AUTH_TOKEN` for uploading source maps (decision 0672). Never under a `VITE_` name, which would put it in the built app |

Staging and production use separate Cloudflare accounts, or at least tokens scoped to their own projects, so a preview token can never deploy production.

Variables are plain and visible, so they hold only non-secret values (Settings → Secrets and variables → Actions → Variables):

| Name | Used by |
|---|---|
| `STAGING_SUPABASE_URL`, `STAGING_SUPABASE_PUBLISHABLE_KEY` | builds for previews and staging |
| `PROD_SUPABASE_URL`, `PROD_SUPABASE_PUBLISHABLE_KEY` | production builds |
| `STAGING_{PLAYER,CONSOLE,TABLET,DISPLAY,WEB}_URL` | the staging addresses; `STAGING_WEB_URL` also gives staging builds `VITE_WEB_URL` (the console's website previews) and the release's website preview alias |
| `PROD_PLAYER_URL`, `PROD_WEB_URL` | production builds: the website's links into the player app, and `VITE_WEB_URL` |
| `GTM_ID` | every web build, as `VITE_GTM_ID` and `PUBLIC_GTM_ID`, for the apps to read (decision 0298). Until they read it, the container that loads is `TAG_MANAGER_CONTAINER` in `@rivr/ui`'s cookie banner, so change both together |
| `PROD_CASHFREE_ENVIRONMENT` | `sandbox` keeps production on Cashfree's sandbox through releases (decision 0421); unset means `production` |
| `PROD_TABLET_URL` | the hosted bundle the APK shell loads |
| `PROD_DISPLAY_URL` | the hosted TV app, so `device-pair` answers TVs asking for a pairing code (#49) |
| `SENTRY_DSN_PLAYER` | the player app's staging and production builds, as `VITE_SENTRY_DSN_PLAYER` (decisions 0604, 0672): the address of the player's Sentry key for that environment, public in the built app. A variable of each of the `staging` and `production` environments, each its own key, not of the repository, so no preview or pull-request build is given one. Unset: that environment's player reports nothing |

Auth and API on staging and production, in the Supabase dashboard:

- Turn the email provider off entirely (Authentication → Sign In / Providers → Email), not only email sign-up. Auth records any verified email code or magic link as a code sign-in, which the access-token hook below accepts.
- Turn phone confirmations on ("Confirm phone"). Without it, Auth confirms a phone at a password sign-up without sending a code, and with the access-token hook on, a new member's first code request fails.
- Set the rate limits from `[auth.rate_limit]` in `supabase/config.template.toml`.
- Expose only the `public` and `graphql_public` schemas, never `private`.
- On staging, add every seed phone number someone will sign in with (`supabase/seed/`) as a test number, so a seed sign-in never sends a real SMS. Until a number is added, signing in with it sends a real code to whoever holds it once an SMS or WhatsApp channel is set. Give them a private code kept outside the repository, never the local `123456`: the seed includes super admins, and anyone who knows the code could sign in as one. Production has no test numbers. `scripts/ci/check-auth-config.mjs` checks both (#229): a release fails if production lists any test number, and the staging deploy warns about any test number that is not a seed number.
- The store builds' keys are set by `scripts/github/store-secrets.sh` (`docs/runbooks/store-listing.md`). Until they are, the store jobs and the tablet's APK are skipped with a notice.
- On production, the only test number is the app stores' reviewer's, and only once the store apps go in for review: first the number in the `auth.store_reviewer` setting, then its private code in Auth's test numbers and the `STORE_REVIEWER_NUMBER` secret. Check no member or staff row holds the number before choosing it. The release fails on any other (decision 0575).
- No CRM (decision 0308): once #797 is deployed, delete what HubSpot left on staging: `pnpm supabase functions delete crm-sync --project-ref <staging>` and `pnpm supabase secrets unset HUBSPOT_ACCESS_TOKEN --project-ref <staging>`. Production never had them.
- The cage agent is removed (decision 0651): after the release that removes it, delete its hosted Edge Function on staging and on production, `pnpm supabase functions delete cage-agent --project-ref <ref>` for each.
- Never run `supabase config push` against staging or production. The generated `config.toml` carries the local hook address, a local secret and the seed's `123456` test numbers.
- Set function secrets with `pnpm supabase secrets set … --project-ref <ref>`, never the bare CLI inside the repository. Run there, `supabase secrets set` also pushes the generated `config.toml`'s `[edge_runtime.secrets]`: this checkout's own `SEND_SMS_HOOK_SECRET` and a `127.0.0.1` `PLAYER_APP_URL`. Every sign-in code to a real number then fails with a 500. The wrapper runs the CLI in an empty directory.
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
  6. WhatsApp through the Evolution bridge, for now (decision 0297):
     - On the bridge, create an instance for RIVR's own number and link it by scanning its QR code with that phone.
     - Set `EVOLUTION_API_URL` (https, no trailing slash), `EVOLUTION_API_KEY` and `EVOLUTION_INSTANCE_NAME` as function secrets, with `pnpm supabase secrets set --env-file <file> --project-ref <ref>` so no value is typed on a command line.
     - Staging sets no `WHATSAPP_ALLOWLIST`, so it messages every number, test members included (decision 0461). Setting one (`+91…`, comma-separated) limits members' messages and alerts to those numbers; sign-in codes always go to whoever asks.
     - Check it: sign in on the player app with a real number on the list; the code arrives on WhatsApp.
     - To move to Meta's Cloud API later, unset the three bridge secrets and follow the next step.
  6a. Once WhatsApp is approved by Meta:
     - In Meta's dashboard, approve the authentication template `sign_in_code` in English, under the language code `en` (RIVR is English only, decision 0027).
     - Set `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_ACCESS_TOKEN` as function secrets. Use a system user's token scoped to `whatsapp_business_messaging` for this one business account; every function in the project can read the secrets.
     - Until a channel is set, every sign-in except the test numbers is refused.
  7. SMS through MSG91 (#181), for numbers not on WhatsApp and for every second code within ten minutes:
     - Register the sign-in template on the DLT portal under RIVR's entity and header, with the code as its one variable, then create an MSG91 OTP template on it.
     - In MSG91, create an auth key for this function alone, and turn off IP security on it, or the calls fail: Supabase Edge Functions have no fixed address.
     - Set a low-balance alert and a daily credit cap in MSG91: each code to a number that asks again costs a message.
     - Set `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` as function secrets. To rotate the key, create the new one, set it as the secret, then delete the old one in MSG91.
     - Check it: on staging, request a code for a number not on WhatsApp, then tap "Send by SMS"; the SMS arrives.
  8. KYC on Zoop.one (decision 0671):
     - In Zoop's dashboard (dashboard.zoop.one), Products: subscribe to Pan Lite, Pan Demographic and Face Match, and ask Zoop to add DigiLocker (it is not self-serve). Manage Apps: add them to the Test App (staging) or the production app (rivr-prod), then generate the app's API key; it is shown once. Leave the IP whitelist off: Edge Functions have no fixed address.
     - Set three function secrets: `ZOOP_APP_ID`, `ZOOP_API_KEY` and `ZOOP_ENVIRONMENT` (`test` on staging with the Test App's key, `live` on rivr-prod with the production app's). Until all three are set, a real venue's KYC stays closed.
     - Check a key without spending a credit: an empty `POST https://test.zoop.one/api/v1/in/identity/pan/lite` (or `live.zoop.one`) with the two headers answers 400 with code 104 (consent missing) for a product on the app, 403 "product not subscribed by app" for one that is not, and 401 for a key Zoop does not accept. A new key took about a minute to be accepted (14 Nov).
     - Until Zoop adds DigiLocker and it is built, the app's check cannot finish: keep `kyc.at_the_club` on.
     - Check them without a release: the Digest column on the secrets page should equal `sha256` of each value as kept locally.
     - Test on staging: Zoop publishes no test values, and the Test App has a few credits per product, each call that answers spending one. Until DigiLocker is built, a staging member takes the selfie (no vendor call) and Continue to DigiLocker says ID checks are not open yet. Face Match was proved on 15 Nov with AI-made faces, never a real person's photo.
  9. The cameras (#122), once the recorder is installed:
     - In the console, Cameras: add each camera with its channel, over its table or on the cage.
  10. Ad conversions (#161, #162, decision 0279), once the ad accounts exist:
     - Meta: in Events Manager, the club's dataset id is `META_PIXEL_ID`. A system user's token with access to that dataset is `META_CAPI_ACCESS_TOKEN`.
     - Google Ads: create one offline conversion action for each kind (kyc_complete, first_visit, tournament_entry, repeat_visit). Set `GOOGLE_ADS_CONVERSION_ACTIONS` to JSON naming each, as `customers/<id>/conversionActions/<id>`. Also set `GOOGLE_ADS_DEVELOPER_TOKEN`, `GOOGLE_ADS_CLIENT_ID`, `GOOGLE_ADS_CLIENT_SECRET`, `GOOGLE_ADS_REFRESH_TOKEN` and `GOOGLE_ADS_CUSTOMER_ID` (digits only), plus `GOOGLE_ADS_LOGIN_CUSTOMER_ID` for a manager account.
     - Check them: a member with marketing consent checks in on staging, and the visit shows in Events Manager's test events and Google's conversion diagnostics within the hour.
  11. The lock-screen live status in the player's native app (decisions 0323, 0361), once the store accounts exist:
     - Android: in the Firebase console, create a project, add an Android app with the package `club.rivr.player`, and download its `google-services.json` into `apps/player/android/app/` for the build (it is gitignored; never commit it). Under Project settings → Service accounts, generate a private key for a service account that may send Cloud Messaging, and set its whole JSON as the function secret `FCM_SERVICE_ACCOUNT`, with `pnpm supabase secrets set --env-file <file> --project-ref <ref>` so no value is typed on a command line. Delete the downloaded key file afterwards.
     - iOS (needs an Apple Developer account and a Mac, `apps/player/README.md`): register the App ID `club.rivr.player` with Push Notifications, and create an APNs key (Keys → +, Apple Push Notifications service). Set `APNS_TEAM_ID`, `APNS_KEY_ID` and `APNS_PRIVATE_KEY` (the `.p8` file's whole text) as function secrets, and `APNS_ENVIRONMENT=production` only for TestFlight and App Store builds (a development build uses Apple's sandbox).
     - Then schedule the two jobs, which are off until the keys are set: `select private.schedule_outbox_consumer('live-status');` and `select private.schedule_outbox_consumer('native-push');` in the SQL editor. With only one key set, the other kind of phone is skipped.
     - Check it: turn Notifications on this phone on in the native app's Profile, join a list from the console, and the phone shows Waiting; call the seat, and it shows the hold counting down.
  12. Error reports in Sentry (decisions 0604, 0672, 0673), organisation `rivr-poker`, a project per app: `rivr-player`, `rivr-console`, `rivr-tablet`, `rivr-display`, `rivr-web`:
     - Client Keys: one key per environment, `production` and `staging`, each with a rate limit (100 and 30 an hour). Each key's DSN is the variable `SENTRY_DSN_<APP>` (`SENTRY_DSN_PLAYER`, `_CONSOLE`, `_TABLET`, `_DISPLAY`, `_WEB`) of its GitHub environment (`gh variable set SENTRY_DSN_PLAYER --env staging`, reading the value from standard input).
     - Allowed Domains, each project its own two deploys: `app.rivrpoker.com`, `console.rivrpoker.com`, `tablet.rivrpoker.com`, `tv.rivrpoker.com`, `rivrpoker.com` with `www.rivrpoker.com`, and each one's staging address (`https://rivr-<app>-staging.pages.dev`; the website's `STAGING_WEB_URL`). A report from anywhere else is dropped.
     - Source maps: one organisation token with the `org:ci` scope per environment (Settings → Organization Tokens), each set as the secret `SENTRY_AUTH_TOKEN` of its environment, so either can be revoked alone. Without it a deploy still reports, its stacks minified.
     - Check it: after a deploy, Sentry → Issues filtered to the environment shows each new report; its stack names files under `src/`, not `assets/index-*.js`. After the release that carries decision 0672, the website's privacy page names Sentry. To stop reports at once, disable the key; nothing needs deploying.
  - To rotate the hook secret: add the new secret in the hook settings (Auth accepts several, separated by `|`), set `SEND_SMS_HOOK_SECRET` to the new one, then remove the old one from the hook.
  - CAPTCHA on code requests (#182). Without it, anyone can use up the project-wide hourly code limit with requests to random numbers, which locks every member out of sign-in. In this order, staging first:
    1. In Cloudflare, add a Turnstile widget (Managed mode) with the exact hostnames: the production player and console Pages projects (`rivr-player.pages.dev`, `rivr-console.pages.dev`) and the production domains (`app.rivrpoker.com`, `console.rivrpoker.com`). Staging uses Cloudflare's test keys instead (step 2). Never a bare `pages.dev`, which would let every Pages site use the key. Note the site key and secret.
    2. In GitHub, set `PROD_TURNSTILE_SITE_KEY` to the site key, and `STAGING_TURNSTILE_SITE_KEY` to Cloudflare's always-pass test site key `1x00000000000000000000AA` (on staging, use its test secret `1x0000000000000000000000000000000AA` in step 3). 'Send code' waits for a Turnstile token, and a real widget may never give one to the release's headless checks against staging (decision 0420). Then run the deploy. Check that the sign-in steps load the widget. Auth ignores the token while its CAPTCHA is off, so sign-in keeps working.
    3. Only then, in Supabase under Authentication → Attack Protection, turn CAPTCHA protection on with the provider Turnstile and the secret: the widget's on rivr-prod, and the test secret `1x0000000000000000000000000000000AA` on staging. A real secret on staging refuses the test key's tokens and stops staging's sign-in.
    4. Check that a sign-in still works.
  - The hourly code limit: under Authentication → Rate Limits, set "SMS messages" for launch day, for example 300 an hour on production (about 150 members and staff signing in twice). When Auth refuses codes for this limit (`over_sms_send_rate_limit`), the sign-in screen raises one `auth.sms_rate_limit` alert for the owner dashboard, at most every 15 minutes (`sign-in-alert`).

Outbox consumers (#215, decision 0038), on staging and production, once:

- pg_cron runs each consumer's Edge Function every minute through `private.run_outbox_consumer`, which reads the project's address and the scheduler's secret from Vault at each run. Until both are there, a run does nothing, and no consumer runs. It never sends the service-role key.
- Make a secret on your own computer: `openssl rand -hex 32`. Keep it only as long as these steps take.
- On the Vault page (Project Settings → Vault, or Integrations → Vault), add `project_url` = `https://<project-ref>.supabase.co`, and `outbox_scheduler_secret` = the secret. Use the Vault page, not the SQL editor, which keeps what is typed in it.
- Under Edge Functions → Secrets, set `OUTBOX_SCHEDULER_SECRET` to the same secret.
- Check it: within ten minutes of the first event, `select consumer, count(*) from outbox_delivery group by 1` in the SQL editor names the consumers. An empty answer means no consumer runs, which no alert says until each has claimed once (decision 0191).
- To rotate it, change both to a new secret, the Edge Function secret first. Runs refused in between are tried again the next minute.
- Check it: `select jobname, schedule from cron.job;` lists `outbox-<function>` for each consumer, and `select status_code, created from net._http_response order by created desc limit 5;` shows 200s.

## Releasing

1. Confirm the day's `main` is green and its staging deploy of the commit you will release, or of a later commit, succeeded. The release refuses a commit that is not on `main` or whose migrations staging does not have yet. Main keeps merging while a release runs: the release checks its own build on a preview alias (decision 0422).
2. `git tag release-20261115-1 <commit> && git push origin release-20261115-1`. Only repository admins can create `release-*` tags; agents never do. N runs from 1 to 99 per day, and the APK version code is YYYYMMDD × 100 + N.
3. Approve the `production` deployment when the Release workflow asks. If the staging e2e run fails, nothing reaches production.

## Rolling back

- Web: Cloudflare Pages → the project → Deployments → roll back to the previous production deployment.
- Database: never revert a migration in production. Write a forward-fix migration and release it.
- Tablets: the APK loads the hosted bundle, so a Pages rollback rolls the tablets back too.

## First-time repository setup

Run `scripts/github/setup-repo.sh` once with admin rights: labels, branch protection on `main` (requires `ci-ok` and `agent-review`, a pull request up to date with `main`, admins included), squash-only merges with auto-merge, approval for workflows from outside contributors, the three environments and the `release-*` tag rule. Safe to run again.
