# Engineering reference

Read by Lane 0 when setting up the repository, and by anyone changing tooling.

## Dates

| Date | Gate |
|---|---|
| Fri 16 Oct | Lane 0 done: schema, lane contracts and task queues frozen |
| Fri 30 Oct | Release A: registration, KYC, Academy booking, website, link-in-bio, brand kit, social templates |
| Sun 1 Nov | Floor stack live in the practice venue for staff training |
| Tue 10 Nov | Feature freeze |
| Wed 11 to Sat 14 Nov | Hardening only: load, outage and restore drills, fixes |
| Sun 15 Nov | Launch |

## Stack

- **Language:** TypeScript everywhere, `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- **Monorepo:** pnpm workspaces and Turborepo.
- **Apps:** React 19 and Vite for `player`, `console`, `tablet`, `display`, `driver`; Astro for `web`, rendered on demand on Cloudflare from content stored in Supabase, with React islands for live sections. Capacitor for the Android builds; the shells load the hosted, versioned web bundle with a service worker for offline use, so design and code changes reach the tablets without reinstalling an APK.
- **Routing and data:** TanStack Router, TanStack Query.
- **Forms and validation:** React Hook Form with Zod. Zod schemas are the single source of input validation on client and server.
- **Design tokens:** one file, `packages/tokens/tokens.json`, in the W3C Design Tokens format. Style Dictionary generates every consumer from it: CSS custom properties, the Tailwind preset, TypeScript constants, Android `colors.xml` and theme, the PWA manifest colours, and the chart palette. Generated files are never edited by hand and CI fails if they are stale.
- **Styling:** Tailwind CSS with the generated preset, whose values point at the CSS custom properties; Radix UI primitives underneath our own components.
- **Fonts:** Bodoni Moda and Instrument Sans from `@fontsource`.
- **Backend:** Supabase in Mumbai: Postgres, row-level security, Realtime, Edge Functions (Deno), pg_cron, Storage. Projects: `rivr-staging`, `rivr-prod`.
- **Offline:** IndexedDB queue through one shared package.
- **Graphics:** `@rivr/render` renders `@rivr/ui` components in headless Chromium (Playwright) to PNG and PDF, and with Remotion to MP4, so TV slides, social cards, receipts and the membership card use the same CSS as the apps. Satori is not used; it supports only a subset of CSS and would drift from the apps.
- **Testing:** Vitest, fast-check, Stryker, Testing Library, Playwright, pgTAP.
- **Component workshop:** Storybook for `@rivr/ui`.
- **Hosting:** Cloudflare Pages for `player`, `console`, `display`, `web`, with a preview deployment per PR.
- **Monitoring:** Sentry in every app and Edge Function, with personal data scrubbed. No product analytics; the growth funnel is built in lane D from our own data.
- **CI:** GitHub Actions on the self-hosted runner.

Add a dependency only with a line in the PR saying why the platform and the existing dependencies do not cover it.

## Repository layout

```
apps/
  player/  console/  tablet/  display/  web/  driver/
packages/
  tokens/      tokens.json (the single design source) and the outputs Style Dictionary generates from it
  ui/          the component library. Every visible element in every app comes from here
  domain/      pure TypeScript business rules: money, rake, TDS, GST, waitlist priority, payouts, points
  db/          generated database types, typed query functions, query keys, Realtime subscriptions
  contracts/   Zod schemas and types shared across lanes and with Edge Functions
  i18n/        message catalogues (en, hi) and formatters for money, time and stakes
  offline/     IndexedDB outbox, ordered replay, idempotency keys
  render/      graphics templates and the render service client
  drills/      the drill engine ported from poker-settle
  adapters/    one interface per vendor, each with a real implementation and an in-memory fake
  config/      shared ESLint, TypeScript, Tailwind, Vitest, Playwright, Stryker configuration
  testing/     factories, seed data from the design prompt, golden-test helpers
supabase/
  migrations/  functions/  seed/  tests/
docs/
  spec/  design/  decisions/  contracts/  runbooks/  status/  questions.md
```

Adapters to create: KYC (with DigiLocker and face match), SMS OTP, WhatsApp, UPI payouts, push, social publishing (one target per channel), social inbox, Instagram Graph (social wall), channel analytics, Meta Conversions API, Google Ads offline conversions, Cloudflare cache purge, store, CCTV recorder, receipt printer, kitchen printer.

## Architecture rules (enforced by ESLint and dependency-cruiser)

Enforced by ESLint and dependency-cruiser in CI.

1. **Layering inside an app:** `routes → features → (ui, db, domain, contracts, i18n)`. A feature never imports another feature; shared logic moves to a package.
2. **Packages never import apps.** `domain` imports only `contracts`. `ui` imports only `tokens` and `i18n`. `db` is the only package that touches the Supabase client.
3. **Business rules live in `@rivr/domain` only.** No rake, cap, TDS, GST, marker, bonus or priority arithmetic in a component, hook, view or Edge Function. When the database must compute money, it uses a SQL function covered by golden tests that assert equality with `domain` on the same cases.
4. **One way to do each thing:** one data-fetching pattern, one form pattern, one modal, one toast, one table, one money and time formatter, one error boundary, one logger, one feature-flag reader. If you need a second way, change the first.
5. **Vendors only behind `@rivr/adapters`.** Feature code never imports a vendor SDK. Fakes serve tests, Storybook and the practice venue, and stand in for any vendor whose keys have not arrived.
6. **Every record carries `venue_id`.** Row-level security filters by venue on every table. The practice venue is a real venue with `is_practice = true`. Reports, Tally, GST, Meta events, investor statements and external outbox consumers exclude it by policy in one place.
7. **Events go through the outbox.** A business event writes one `outbox_event` row in the same transaction as the change. Publishing, WhatsApp, winner cards, Meta Conversions API, feedback, review requests and Tally are consumers. Nothing calls an external service inline.
8. **Public surfaces read only public views** that contain no personal data: `web`, `display`, link-in-bio, live floor widget.

## ESLint rules Lane 0 must configure (all errors, no warnings)

- `max-lines`: 250 per file; `max-lines-per-function`: 40; `complexity`: 10; `max-depth`: 3; `max-params`: 4
- `@typescript-eslint/no-explicit-any`, `no-non-null-assertion`, `consistent-type-assertions` (only in `**/parse/**`)
- `no-console`, `no-warning-comments` (TODO without an issue link)
- `react/forbid-elements` in `apps/**` for every intrinsic element; `react/forbid-component-props` for `className` and `style`
- `no-restricted-imports` in `apps/**` for Radix, Tailwind, icon sets, styling libraries and `@supabase/supabase-js`
- `no-restricted-syntax` for hex literals and arbitrary Tailwind values outside `packages/tokens`
- `i18next/no-literal-string` (or equivalent) in `apps/**` and `packages/ui/**`
- dependency-cruiser: the layering in "Architecture rules", no feature-to-feature imports, no cycles
- `stylelint` with no files allowed under `apps/**`

## Security checks in CI

- Row-level security on every table, default deny. The service-role key exists only in Edge Functions and CI secrets.
- Staff authentication with role, device binding and IP allowlist for cage and admin. Cage sessions time out after 10 minutes idle.
- Rate limits on OTP, login, withdrawal and marker endpoints.
- Webhooks verify signatures. Secrets live in the Supabase vault and GitHub secrets.
- CI runs `supabase db lint`, the Supabase security advisors, dependency audit and secret scanning; a new finding fails the build.
- CI jobs from forks never run on the self-hosted runner.
